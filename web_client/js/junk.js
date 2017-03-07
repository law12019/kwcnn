import { staticRoot } from 'girder/rest';
import { restRequest } from 'girder/rest';
import View from 'girder/views/View';


// multiple images
// Sort detection annotation rectangles into arbitrary classes
var LightBoxView = View.extend({
  initialize: function (settings) {
    this.settings = settings;
    this.ClassNames = settings.metaData.classes;

    if (!$('head #large_image-slideatlas-css').length) {
      $('head').prepend(
        $('<link>', {
          id: 'large_image-slideatlas-css',
          rel: 'stylesheet',
          href: staticRoot + '/built/plugins/large_image/extra/slideatlas/sa.css'
        })
      );
    }

    $.getScript(
      staticRoot + '/built/plugins/large_image/extra/slideatlas/sa-all.max.js',
      () => this.render()
    );
  },

  _getTileUrl: function (level, x, y) {
    var url = apiRoot + '/item/' + this.ImageId + '/tiles/zxy/' +
      level + '/' + x + '/' + y;
    return url;
  },

  // Render is really initialize.
  render: function () {
    // If script or metadata isn't loaded, then abort
    if (!window.SA) {
      return;
    }

    // For the expanded viewer:
    // Mask is to gray out background and consume events.
    // All lightbox items in this parent will share a mask.
    this.Mask = $('<div>')
      .appendTo(this.$el)
      .addClass('sa-light-box-mask') // So it can be retrieved.
      .hide()
      .css({'position': 'absolute',
            'left': '0px',
            'top': '0px',
            'width': '100%',
            'height': '100%',
            'z-index': '99',
            'opacity': '0.5',
            'background-color': '#000'});
    this.ViewerDiv = $('<div>')
      .appendTo(this.$el)
      .hide()
      .css({'position': 'absolute',
            'left': '5%',
            'width': '90%',
            'top': '5%',
            'height': '90%',
            'border': '1px solid #000',
            'z-index': '100'});
    SA.SAViewer(this.ViewerDiv,
                {zoomWidget: true,
                 drawWidget: false,
                 prefixUrl: staticRoot + '/built/plugins/large_image/extra/slideatlas/img/'});
    this.SAViewer = this.ViewerDiv[0].saViewer;
    //this.girderGui = new SAM.GirderWidget(this.viewer.GetAnnotationLayer(), this.itemId);

    // This is awkward.  SlideAtlas needs to kno the path to its own images.
    SA.ImagePathUrl = staticRoot + '/built/plugins/large_image/extra/slideatlas/img/';
    // Class objects just store labels and colors.
    this.ClassObjects = [];
    for (var i = 0; i < this.ClassNames.length; ++i) {
      var classObj = {label: this.ClassNames[i],
                      index:i};
      this.ClassObjects.push(classObj);
      // assign colors to the labels
      // detections will be yellow
      // Detection class is yellow.
      if (i === 0) {
        classObj.color = '#FF8000';
      } else if (i === 1) { // Second (false positive) is red
        classObj.color = '#FF0000';
      } else if (i == 2) { // last (true positive) is green
        classObj.color = '#00FF00';
      } else {
        // the rest will range from purple to cyan
        var k = (i - 3) / (this.ClassObjects.length - 4);
        this.ClassObjects[i].color = SAM.ConvertColorToHex([k, 1 - k, 1]);
      }
    }

    this.Container = $('<div>')
      .appendTo(this.$el)
      .css({'width':'100%',
            'margin-right':'30px',
            'overflow':'auto',
            'position':'relative'});
    SA.SAFullScreenButton(this.Container)
      .css({'position': 'absolute', 'right': '2px', 'top': '2px'});

    $('<button>')
      .appendTo(this.Container)
      .css({'z-index':'10',
            'position': 'absolute',
            'top': '2px',
            'right': '40px'})
      .text('Save')
      .prop('title', 'Save annotations to server')
      .click( () => this._saveAnnotations() );

    // Setup the call back to change the class of an element.
    var self = this;

    // We need to keep all the annotations to save changes.
    // Image ids are the keys for the imagess object.
    this.Tree = {'div':this.Container, images: []};

    // Girder: Request all of the images in the folder.
    var folderId = this.parentView.model.parent.id;
    var self = this;
    restRequest({
      type: 'GET',
      path: "/item?folderId="+folderId+"&limit=50&offset=0&sort=lowerName&sortdir=1",
    }).done(function (resp) {
      for (var i = 0; i < resp.length; ++i) {
        var item = resp[i];
        if (item.largeImage) {
          var imageId = item._id;
          var imageAccordian = SA.AccordianDiv(self.Container, item.name).css({'width':'100%'});
          var imageObj = {'_id': imageId,
                          'div':imageAccordian,
                          'annotations': []};
          self.Tree.images.push(imageObj);
          self._loadImage(imageId, imageObj);
          imageAccordian[0].open();
        }
      }
    });
  },

  _loadImage: function (imageId, imageObj) {
    // Find all of the annotations for this image.
    var self = this;
    restRequest({
      type: 'GET',
      path: "/annotation?itemId="+imageId+"&limit=50&offset=0",
    }).done(function (resp) {
      // First sort the annotations to be in the same order as classes.
      var sortedResp = [];
      var classIdx, annotName;
      for (var i = 0; i < resp.length; ++i) {
        annotName = resp[i].annotation.name;
        classIdx = self.ClassNames.indexOf(annotName);
        if (classIdx != -1) {
          sortedResp[classIdx] = resp[i];
        }
      }

      var imageAccordian = imageObj.div;
      for (classIdx = 0; classIdx < sortedResp.length; ++classIdx) {
        annotName = sortedResp[classIdx].annotation.name;
        var annotId = sortedResp[classIdx]._id;
        var classObj = self.ClassObjects[classIdx];
        var annotAccordian = SA.AccordianDiv(imageAccordian, classIdx+": "+annotName).css({'width':'100%'});
        var annotObj = {'_id': annotId,
                        'div': annotAccordian,
                        'class': classObj,
                        'chips': [],
                        'imageId': imageId,
                        'modified': false};
        annotAccordian[0].getLabel()
          .css({'color': classObj.color,
                'cursor': 'default'});
        imageObj.annotations[classIdx] = annotObj;
        self._loadAnnotation(annotId, annotObj);
        if (classIdx === 0) {
          annotAccordian[0].open();
        }
      }
    });
  },

  _loadAnnotation: function (annotId, annotObj) {
    // Find all of the tiles for this annotation.
    var self = this;

    // Select all when hovering over the annotation label.
    var annotAccordian = annotObj.div;
    annotAccordian[0].getLabel()
      .attr('tabindex', '0')
      .hover(
        function () {
          // Prepare for a key to change the class of all annotations.
          $(this).focus();
          $(this).css({'background-color': '#FF0'});
          annotAccordian.find('.img-div').css({'border': '4px solid #FF0'});
        },
        function () {
          $(this).blur();
          $(this).css({'background-color': '#FFF'});
          // Change the elements back the their assigned colors.
          for (var i = 0; i < annotObj.chips.length; ++i) {
            var chipObj = annotObj.chips[i];
            var img = chipObj.img;
            if (chipObj.class === annotObj.class) {
              img.css({'border': '4px solid #FFF'});
            } else {
              img.css({'border': '4px solid '+chipObj.class.color});
            }
          }
        })
      .on('keydown',
          function (event) {
            var numClasses = self.ClassNames.length;
            if (event.keyCode >= 48 && event.keyCode < 48+numClasses) { // 0,1,2 ...
              // Change the class of the element.
              var newClassIdx = event.keyCode - 48;
              var newClassObj = self.ClassObjects[newClassIdx];
              for (var i = 0; i < annotObj.elementClasses.length; ++i) {
                annotObj.elementClasses[i] = newClassObj;
                annotObj.annotation.elements[i].scalar = 1.0;
                if (newClassObj == annotObj.class) {
                  annotObj.images[i].css({'border': '4px solid #EEE'});
                } else {
                  annotObj.images[i].css({'border': '4px solid '+newClassObj.color});
                }
                // Class changes do not take effect until reshuffling at
                // save. No need to mark as modified here.
              }
            }
            return false;
          });

    // The previous request oly returned the annots id.
    // This returns the annot object with all its rectangles.
    restRequest({
      type: 'GET',
      path: "/annotation/"+annotId,
    }).done(function (resp) {
      annotObj.annotation = resp.annotation;
      self._renderAnnotation(annotObj);
    });
  },

  _renderAnnotation: function (annotObj) {
    annotObj.div.empty();
    for (var i = 0; i < annotObj.annotation.elements.length; ++i) {
      var chipObj = {
        // User changes this.
        // Keep track of class reassigments without actually moving them.
        class: annotObj.class,
        // should I just changes this to a referecne to the element?
        //elementIndex: i,
        element: annotObj.annotation.elements[i],
        // Needed to compare classes, get imageId and annot element.
        annot: annotObj};
      annotObj.chips.push(chipObj);
      this._renderAnnotationElement(chipObj);
    }
  },

  // TODO: Change elements into an object rather than relying on closure.
  // This assumes that elements are suffled into their home annotation.
  // This initialize the elementClasses and images arrays.
  _renderAnnotationElement: function (chipObj) {
    var self = this;
    var classObj = chipObj.class;
    var annotObj = chipObj.annot;
    var e = chipObj.element;
    if (e.type == "rectangle"){
      var left = Math.round(e.center[0]-e.width/2);
      var top  = Math.round(e.center[1]-e.height/2);
      // Use closure to keep track of images state?
      var imageId = annotObj.imageId;
      var imgDiv = $('<div>')
        .appendTo(annotObj.div)
        .addClass("img-div")
        .css({'height':'88px',
              'width':'88px',
              'margin':'1px',
              'display':'inline-block',
              'position':'relative',
              'cursor': 'crosshair',
              'border': '4px solid #EEE'})
        .attr('tabindex', '0')
        .prop('src','api/v1/item/'+imageId+'/tiles/region?left='+left
              +'&top='+top+'&regionWidth='+e.width+'&regionHeight='+e.height
              +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
      var img = $('<img>')
        .appendTo(imgDiv)
        .addClass("img-view")
        .css({'height':'80px',
              'width':'80px',
              'cursor': 'crosshair'})
        .attr('tabindex', '0')
        .prop('src','api/v1/item/'+imageId+'/tiles/region?left='+left
              +'&top='+top+'&regionWidth='+e.width+'&regionHeight='+e.height
              +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
      chipObj.img = imgDiv; // We only change the border with this reference.

      // viewerButton
      var vb = $('<img>')
        .appendTo(imgDiv)
        .addClass("viewer-button")
        .css({'height': '16px',
              'width': '16px',
              'opacity':'0.4',
              'position': 'absolute',
              'top': '-5px',
              'right': '-5px',
              'cursor': 'auto'})
        .prop('src', SA.ImagePathUrl+'corner32.png')
        .hover(
          function () {$(this).css({'opacity':'1.0'});},
          function () {$(this).css({'opacity':'0.4'});})
        .click( () => this._expandViewer(chipObj));

      imgDiv
        .hover(
          function () {
            imgDiv.css({'border': '4px solid #FF0'});
            // Prepare to receive key events.
            imgDiv.focus();
          },
          function () {
            var elementClass = chipObj.class;
            if (elementClass == annotObj.class) {
              imgDiv.css({'border': '4px solid #EEE'});
            } else {
              imgDiv.css({'border': '4px solid '+elementClass.color});
            }
            // Stop receiving key events.
            imgDiv.blur();
          })
        .on('keyup',
          function (event) {
            if (event.keyCode === 17) { // control key
              // Control click expands the viewer.
              $(this).css({'cursor': 'crosshair'});
            }
          })
        .on('keydown',
          function (event) {
            var numClasses = self.ClassNames.length;
            if (event.keyCode === 17) { // control key
              // Control click expands the viewer.
              $(this).css({'cursor': 'auto'});
            } else if (event.keyCode === 38) { // up arrow
              e.width = Math.round(e.width * 0.9);
              e.height = Math.round(e.height * 0.9);
              var l = Math.round(e.center[0]-e.width/2);
              var t  = Math.round(e.center[1]-e.height/2);
              img.prop('src','api/v1/item/'+imageId+'/tiles/region?left='+l
                       +'&top='+t+'&regionWidth='+e.width+'&regionHeight='+e.height
                       +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
              annotObj.modified = true;
              return false;
            } else if (event.keyCode === 40) { // down arrow
              e.width = Math.round(e.width / 0.9);
              e.height = Math.round(e.height / 0.9);
              var l = Math.round(e.center[0]-e.width/2);
              var t  = Math.round(e.center[1]-e.height/2);
              img.prop('src','api/v1/item/'+imageId+'/tiles/region?left='+l
                       +'&top='+t+'&regionWidth='+e.width+'&regionHeight='+e.height
                       +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
              annotObj.modified = true;
              return false;
            } else if (event.keyCode >= 48 && event.keyCode < 48+numClasses) { // 0,1,2 ...
              // Change the class of the element.
              var newClassIdx = event.keyCode - 48;
              var newClassObj = self.ClassObjects[newClassIdx];
              chipObj.class = newClassObj;
              // If the user sets the class, confidence gets set to 1.
              e.scalar = 1.0;
              if (newClassObj == annotObj.class) {
                imgDiv.css({'border': '4px solid #EEE'});
              } else {
                imgDiv.css({'border': '4px solid '+newClassObj.color});
              }
              // Class changes do not take effect until reshuffling at
              // save. No need to mark as modified here.
            }
            return false;
          })
      .on('click',
          function (event) {
            // Control click expands the viewer.
            if (event.ctrlKey) {
              self._expandViewer(clipObj);
              return false;
            }
            // Recenter the image chip.
            var hw = imgDiv.width()/2.0;
            var hh = imgDiv.height()/2.0;
            var dx = (event.offsetX-hw) / (2*hw);
            var dy = (event.offsetY-hh) / (2*hh);
            e.center[0] = Math.round(e.center[0] + (dx * (e.width)));
            e.center[1] = Math.round(e.center[1] + (dy * (e.height)));
            var l = Math.round(e.center[0]-e.width/2);
            var t  = Math.round(e.center[1]-e.height/2);
            console.log('new position: '+l+', '+t);
            img.prop('src','api/v1/item/'+imageId+'/tiles/region?left='+l
              +'&top='+t+'&regionWidth='+e.width+'&regionHeight='+e.height
              +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
            annotObj.modified = true;
            return false;
          });
    }
  },

  // Note: potential problem with partial saving.
  // Actually move the elements to the right annotations, then save to girder.
  _saveAnnotations: function () {
    // Make copies of all the girder annotations.
    for (var imgIdx = 0; imgIdx < this.Tree.images.length; ++imgIdx) {
      var imgObj = this.Tree.images[imgIdx];
      for (var annotIdx = 0; annotIdx < imgObj.annotations.length; ++annotIdx) {
        var annotObj = imgObj.annotations[annotIdx];
        annotObj.newAnnotation = {name: annotObj.annotation.name,
                                  elements: []};
      }
    }

    // Move the elements to their new annotation.
    for (var imgIdx = 0; imgIdx < this.Tree.images.length; ++imgIdx) {
      var imgObj = this.Tree.images[imgIdx];
      for (var annotIdx = 0; annotIdx < imgObj.annotations.length; ++annotIdx) {
        var annotObj = imgObj.annotations[annotIdx];
        var numElements = annotObj.annotation.elements.length;
        for (var eIdx = 0; eIdx < numElements; ++eIdx) {
          var element = annotObj.annotation.elements[eIdx];
          var elementClass = annotObj.chips[eIdx].class;
          var destAnnot = imgObj.annotations[elementClass.index];
          if (elementClass != annotObj.class) {
            annotObj.modified = true;
            destAnnot.modified = true;
          }
          // Odd that elements from girder have ids. Have to get rid of them.
          // name.  get rid of the redundant per element label.
          // annotation label is really meant to be rendered. However, we
          // are rendering it as color. ......
          // 'label': element.label, // Label is just the annotations
          var newElement = {'type': element.type,
                            'center': element.center,
                            'height': element.height,
                            'width': element.width,
                            'rotation': element.rotation,
                            'scalar': element.scalar};
          destAnnot.newAnnotation.elements.push(newElement);
          // Do not change the original elements yet. Wait until they are
          // all saved.
        }
      }
    }

    // Save the annotations that have been modified.
    var self = this;
    this.SavingCount = 0;
    for (var imgIdx = 0; imgIdx < this.Tree.images.length; ++imgIdx) {
      var imgObj = this.Tree.images[imgIdx];
      for (var annotIdx = 0; annotIdx < imgObj.annotations.length; ++annotIdx) {
        var annotObj = imgObj.annotations[annotIdx];
        // Move new annotations to live.
        if (annotObj.modified) {
          this.SavingCount += 1;
          restRequest({
            type: 'PUT',
            path: "/annotation/"+annotObj._id,
            data: JSON.stringify(annotObj.newAnnotation),
            contentType: 'application/json'
          }).done(function (resp) {
            // TODO: Feed back that save was successful
            self.SavingCount -= 1;
            if (self.SavingCount === 0) {
              self._renderModifiedAnnotations();
            }
          });
        }
      }
    }
  },

  _renderModifiedAnnotations: function () {
    for (var imgIdx = 0; imgIdx < this.Tree.images.length; ++imgIdx) {
      var imgObj = this.Tree.images[imgIdx];
      for (var annotIdx = 0; annotIdx < imgObj.annotations.length; ++annotIdx) {
        var annotObj = imgObj.annotations[annotIdx];
        // Do not change annotations until they are all saved.
        annotObj.annotation = annotObj.newAnnotation;
        annotObj.newAnnotation = undefined;
        if (annotObj.modified) {
          this._renderAnnotation(annotObj);
          annotObj.modified = false;
        }
      }
    }
  },

  _expandViewer: function (chipObj) {
    var self = this;

    // Setup the viewer source with the image chip.
    var note = SA.TileSourceToNote(
      {
        height: 1000,
        width: 1200,
        tileSize: 256,
        minLevel: 0,
        maxLevel: this.levels - 1,
        getTileUrl: (level, x, y, z) => {
          // Drop the "z" argument
          return this._getTileUrl(level, x, y);
        }
      }



    // Show the mask.
    this.Mask.show();
    // Clicking outside the div will cause the div to shrink back to
    // its original size.
    this.Mask.on(
      'mousedown.lightbox',
      () => this._hideViewer());
    // TODO: animate expansion.
    this.ViewerDiv.show()
  },

  _hideViewer: function () {
    // Reverse the expansion.
    // hide the mask
    this.Mask.hide();
    // remove event to shrink div.
    this.Mask.off('mousedown.lightbox');
    //this.Div.animate({'top': self.SavedTop,
    //      'left': self.SavedLeft,
    //      'width': self.SavedWidth,
    //      'height': self.SavedHeight,
    //      'z-index': self.SavedZIndex},
    //                         {step: function () { self.Div.trigger('resize'); }});
    this.ViewerDiv.hide();
  }

});

export {LightBoxView};

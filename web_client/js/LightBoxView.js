import { apiRoot } from 'girder/rest';
import { staticRoot } from 'girder/rest';
import { restRequest } from 'girder/rest';
import View from 'girder/views/View';


// multiple images
// Sort detection annotation rectangles into arbitrary classes
var LightBoxView = View.extend({
  initialize: function (settings) {
    this.settings = settings;
    this.ClassNames = settings.metaData.classes;
    this.Open = settings.metaData.open;

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
      .css({'position': 'fixed',
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
      .css({'position': 'fixed',
            'left': '5%',
            'width': '90%',
            'top': '5%',
            'height': '90%',
            'background-color': '#FFF',
            'border': '1px solid #000',
            'z-index': '100'});
    SA.SAViewer(this.ViewerDiv,
                {zoomWidget: true,
                 drawWidget: false,
                 rotatable: false,
                 prefixUrl: staticRoot + '/built/plugins/large_image/extra/slideatlas/img/'});
    this.Viewer = this.ViewerDiv[0].saViewer;
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
        classObj.color = '#FF9000';
      } else if (i === 1) { // Second (false positive) is red
        classObj.color = '#FF0000';
      } else if (i === 2) { // last (true positive) is green
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
    this.Tree = {'container':this.Container, imageNodes: []};

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
          var imageAccordian = SA.AccordianDiv(self.Container, item.name).css({'width':'100%'})[0];
          var imageNode = {'_id': imageId,
                           'accordian':imageAccordian,
                           'annotationNodes': []};
          self.Tree.imageNodes.push(imageNode);
          self._loadImage(imageId, imageNode);
          imageAccordian.open();
        }
      }
    });
  },

  _loadImage: function (imageId, imageNode) {
    var self = this;
    // We need all the image meta data to make a viewer.
    restRequest({
      type: 'GET',
      path: "/item/"+imageId+"/tiles",
    }).done(function (resp) {
      imageNode.image = resp;
    });

    // Find all of the annotations for this image.
    // Make nodes for annotations that match classes.
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

      var imageAccordian = imageNode.accordian;
      for (classIdx = 0; classIdx < sortedResp.length; ++classIdx) {
        annotName = sortedResp[classIdx].annotation.name;
        var annotId = sortedResp[classIdx]._id;
        var classObj = self.ClassObjects[classIdx];
        var annotAccordian = 
          SA.AccordianDiv($(imageAccordian), 
                          classIdx+": "+annotName).css({'width':'100%'})[0];
        $(annotAccordian).css({"min-height":'10px'});
        var annotNode = {'_id': annotId,
                         'imageNode': imageNode,
                         'accordian': annotAccordian,
                         'class': classObj,
                         'chips': [],
                         'modified': false};
        // Color the label by its class.
        annotAccordian.getLabel()
          .css({'color': classObj.color,
                'cursor': 'default'});
        imageNode.annotationNodes[classIdx] = annotNode;
        self._loadAnnotation(annotNode);
      }
    });
  },

  _loadAnnotation: function (annotNode) {
    var self = this;
    var annotId = annotNode._id;
    // Find all of the image chips (rectangle elements) for this annotation.

    // The previous request only returned the annots id.
    // This returns the annot object with all its rectangles.
    restRequest({
      type: 'GET',
      path: "/annotation/"+annotId,
    }).done(function (resp) {
      annotNode.annotation = resp.annotation;
      self._updateChips(annotNode);
      // Load image chips on demand.
      annotNode.accordian.openCallback = () => self._renderChips(annotNode);
      if (self.Open && self.Open.includes(annotNode.class.index)) {
          annotNode.accordian.open();
        }
    });
  },

  _updateChips: function (annotNode) {
    annotNode.chips = [];
    for (var i = 0; i < annotNode.annotation.elements.length; ++i) {
      var e = annotNode.annotation.elements[i];
      // For not it is important to keep all the elements as chips, even
      // though we only use the rectangles. The annotation element index
      // has to match the chip index (when saving).
      var chip = {
        // User changes this to be different than annotNode.class.
        // Keep track of class reassigments without actually moving them.
        class: annotNode.class,
        // should I just changes this to a referecne to the element?
        //elementIndex: i,
        element: e,
        // Needed to compare classes, get imageId and annot element.
        annotNode: annotNode};
      annotNode.chips.push(chip);
    }
  },

  _renderChips: function (annotNode) {
    var self = this;
    $(annotNode.accordian).empty();
    // Loading the image chips. Stop the load on open callback. 
    annotNode.accordian.openCallback = undefined;

    for (var i = 0; i < annotNode.chips.length; ++i) {
      var chip = annotNode.chips[i];
      // Only display rectangle chips.
      if (chip.element.type === "rectangle"){
        this._renderAnnotationElement(chip);
      }
    }

    // Bind actions to the annotation label.
    // Select all chips when hovering over the annotation label.
    var annotAccordian = annotNode.accordian;
    annotAccordian.getLabel()
      .attr('tabindex', '0')
      .hover(
        function () {
          // Prepare for a key to change the class of all annotations.
          $(this).focus();
          $(this).css({'background-color': '#FF0'});
          $(annotAccordian).find('.img-div').css({'border': '4px solid #FF0'});
        },
        function () {
          $(this).blur();
          $(this).css({'background-color': '#FFF'});
          // Change the elements back the their assigned colors.
          // chips are leaves.
          for (var i = 0; i < annotNode.chips.length; ++i) {
            var chip = annotNode.chips[i];
            if (chip.class === annotNode.class) {
              chip.imgDiv.css({'border': '4px solid #FFF'});
            } else {
              chip.imgDiv.css({'border': '4px solid '+chip.class.color});
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
              for (var i = 0; i < annotNode.chips.length; ++i) {
                annotNode.chips[i].class = newClassObj;
                annotNode.annotation.elements[i].scalar = 1.0;
                if (newClassObj.index === annotNode.class.index) {
                  annotNode.chips[i].imgDiv.css({'border': '4px solid #EEE'});
                } else {
                  annotNode.chips[i].imgDiv.css({'border': '4px solid '+newClassObj.color});
                }
                // Class changes do not take effect until reshuffling at
                // save. No need to mark as modified here.
              }
            }
            return false;
          });
  },

  // TODO: Change elements into an object rather than relying on closure.
  // This assumes that elements are shuffled into their home annotation.
  _renderAnnotationElement: function (chip) {
    var self = this;
    var classObj = chip.class;
    var annotNode = chip.annotNode;
    var e = chip.element;
    var left = Math.round(e.center[0]-e.width/2);
    var top  = Math.round(e.center[1]-e.height/2);
    // Use closure to keep track of images state?
    var imageId = annotNode.imageNode._id;
    var imgDiv = $('<div>')
      .appendTo($(annotNode.accordian))
      .addClass("img-div")
      .css({'height':'88px',
            'width':'88px',
            'margin':'1px',
            'display':'inline-block',
            'position':'relative',
            'cursor': 'crosshair',
            'border': '4px solid #EEE'})
      // needed to receive key events
      .attr('tabindex', '0'); 
    var img = $('<img>')
      .appendTo(imgDiv)
      .addClass("img-chip")
      .css({'height':'80px',
            'width':'80px',
            'cursor': 'crosshair'})
      .attr('tabindex', '0')
      .prop('src','api/v1/item/'+imageId+'/tiles/region?left='+left
            +'&top='+top+'&regionWidth='+e.width+'&regionHeight='+e.height
            +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
    chip.imgDiv = imgDiv; // We only change the border with this reference.

    var viewerButton = $('<img>')
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
      .click( () => this._expandViewer(chip));

    // Bind actions to the image chip display.
    imgDiv
      .hover(
        function () { // mouse in
          imgDiv.css({'border': '4px solid #FF0'});
          // Prepare to receive key events.
          imgDiv.focus();
        },
        function () { // mouse out
          var elementClass = chip.class;
          if (elementClass.index === annotNode.class.index) {
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
              imgDiv.css({'cursor': 'crosshair'});
              viewerButton.css({'opacity':'1.0'});
            }
          })
      .on('keydown',
          function (event) {
            var numClasses = self.ClassNames.length;
            if (event.keyCode === 17) { // control key
              // Control click expands the viewer.
              imgDiv.css({'cursor': 'auto'});
              viewerButton.css({'opacity':'1.0'});
            } else if (event.keyCode === 38) { // up arrow
              e.width = Math.round(e.width * 0.9);
              e.height = Math.round(e.height * 0.9);
              var l = Math.round(e.center[0]-e.width/2);
              var t  = Math.round(e.center[1]-e.height/2);
              img.prop('src','api/v1/item/'+imageId+'/tiles/region?left='+l
                       +'&top='+t+'&regionWidth='+e.width+'&regionHeight='+e.height
                       +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
              annotNode.modified = true;
              return false;
            } else if (event.keyCode === 40) { // down arrow
              e.width = Math.round(e.width / 0.9);
              e.height = Math.round(e.height / 0.9);
              var l = Math.round(e.center[0]-e.width/2);
              var t  = Math.round(e.center[1]-e.height/2);
              img.prop('src','api/v1/item/'+imageId+'/tiles/region?left='+l
                       +'&top='+t+'&regionWidth='+e.width+'&regionHeight='+e.height
                       +'&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0');
              annotNode.modified = true;
              return false;
            } else if (event.keyCode >= 48 && event.keyCode < 48+numClasses) { // 0,1,2 ...
              // Change the class of the element.
              var newClassIdx = event.keyCode - 48;
              var newClassObj = self.ClassObjects[newClassIdx];
              chip.class = newClassObj;
              // If the user sets the class, confidence gets set to 1.
              e.scalar = 1.0;
              if (newClassObj.index === annotNode.class.index) {
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
              self._expandViewer(chip);
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
            annotNode.modified = true;
            return false;
          });
  },

  // Note: potential problem with partial saving.
  // Actually move the elements to the right annotations, then save to girder.
  _saveAnnotations: function () {
    // Make copies of all the girder annotations.
    for (var imgIdx = 0; imgIdx < this.Tree.imageNodes.length; ++imgIdx) {
      var imgNode = this.Tree.imageNodes[imgIdx];
      for (var annotIdx = 0; annotIdx < imgNode.annotationNodes.length; ++annotIdx) {
        var annotNode = imgNode.annotationNodes[annotIdx];
        annotNode.newAnnotation = {name: annotNode.annotation.name,
                                   elements: []};
      }
    }

    // Move the elements to their new annotation.
    for (var imgIdx = 0; imgIdx < this.Tree.imageNodes.length; ++imgIdx) {
      var imgNode = this.Tree.imageNodes[imgIdx];
      for (var annotIdx = 0; annotIdx < imgNode.annotationNodes.length; ++annotIdx) {
        var annotNode = imgNode.annotationNodes[annotIdx];
        var numElements = annotNode.annotation.elements.length;
        for (var eIdx = 0; eIdx < numElements; ++eIdx) {
          var element = annotNode.annotation.elements[eIdx];
          var elementClass = annotNode.chips[eIdx].class;
          var destAnnot = imgNode.annotationNodes[elementClass.index];
          if (elementClass != annotNode.class) {
            annotNode.modified = true;
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
    for (var imgIdx = 0; imgIdx < this.Tree.imageNodes.length; ++imgIdx) {
      var imgNode = this.Tree.imageNodes[imgIdx];
      for (var annotIdx = 0; annotIdx < imgNode.annotationNodes.length; ++annotIdx) {
        var annotNode = imgNode.annotationNodes[annotIdx];
        // Move new annotations to live.
        if (annotNode.modified) {
          this.SavingCount += 1;
          restRequest({
            type: 'PUT',
            path: "/annotation/"+annotNode._id,
            data: JSON.stringify(annotNode.newAnnotation),
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
    for (var imgIdx = 0; imgIdx < this.Tree.imageNodes.length; ++imgIdx) {
      var imgNode = this.Tree.imageNodes[imgIdx];
      for (var annotIdx = 0; annotIdx < imgNode.annotationNodes.length; ++annotIdx) {
        var annotNode = imgNode.annotationNodes[annotIdx];
        // Do not change annotations until they are all saved.
        annotNode.annotation = annotNode.newAnnotation;
        annotNode.newAnnotation = undefined;
        if (annotNode.modified) {
          annotNode.modified = false;
          this._updateChips(annotNode);
          this._renderChips(annotNode);
        }
      }
    }
  },

  _expandViewer: function (chip) {
    // For debugging
    SA.VIEWER = this.Viewer;
    var self = this;
    var imageNode = chip.annotNode.imageNode;
    var w = imageNode.image.sizeX;
    var h = imageNode.image.sizeY;
    if (!imageNode.cache) {
      var tileSource = {
        height: h,
        width: w,
        tileSize: imageNode.image.tileWidth,
        minLevel: 0,
        maxLevel: imageNode.image.levels - 1,
        getTileUrl: (level, x, y, z) => {
          return  apiRoot + '/item/' + imageNode._id + '/tiles/zxy/' + level + '/' + x + '/' + y;
        }
      };
      imageNode.cache = SA.TileSourceToCache(tileSource);
    }
    // TODO: animate expansion.
    // Visibility before setup is important.
    // TODO: Fix this problem. (on visibility -> UpdateSize()).
    this.ViewerDiv.show();
    this.Viewer.SetCache(imageNode.cache);
    this.Viewer.SetOverViewBounds([0, w - 1, 0, h - 1]);
    var cam = this.Viewer.GetCamera();
    cam.Load({'FocalPoint': chip.element.center,
              // TODO: verify units; degrees or radians?
              'Roll': chip.element.rotation,
              'Height': chip.element.height * 10});
    this.Viewer.ConstrainCamera();
    this.Viewer.GetAnnotationLayer().Reset();
    for (var i = 0; i < imageNode.annotationNodes.length; ++i) {
      this._loadAnnotationIntoViewer(imageNode.annotationNodes[i]);
    }

    // Show the mask.
    this.Mask.show();
    // Clicking outside the div will cause the div to shrink back to
    // its original size.
    this.Mask
      .attr('tabindex', '0')
      .on('mousedown.lightbox', () => this._hideViewer());
    this.Viewer.EscapeCallback = () => this._hideViewer();
    return false;
  },

  _hideViewer: function () {
    // Reverse the expansion.
    // hide the mask
    this.Mask.hide();
    // remove event to shrink div.
    this.Mask.off('mousedown.lightbox');
    this.Viewer.EscapeCallback = undefined;
    //this.accordian.animate({'top': self.SavedTop,
    //      'left': self.SavedLeft,
    //      'width': self.SavedWidth,
    //      'height': self.SavedHeight,
    //      'z-index': self.SavedZIndex},
    //                         {step: function () { self.accordian.trigger('resize'); }});
    this.ViewerDiv.hide();
  },

  // Copied (and modified) from girderAnnotationEditor.
  // TODO: SHare code.
  _loadAnnotationIntoViewer: function (annotNode) {
    // Put all the rectangles into one set.
    var setObj = {};
    setObj.type = 'rect_set';
    setObj.centers = [];
    setObj.widths = [];
    setObj.heights = [];
    setObj.confidences = [];
    setObj.labels = [];

    var annot = annotNode.annotation;
    for (var i = 0; i < annot.elements.length; ++i) {
      var element = annot.elements[i];
      var chip = annotNode.chips[i];
      if (element.type === 'rectangle') {
        setObj.widths.push(element.width);
        setObj.heights.push(element.height);
        setObj.centers.push(element.center[0]);
        setObj.centers.push(element.center[1]);
        if (element.scalar === undefined) {
          element.scalar = 1.0;
        }
        setObj.confidences.push(element.scalar);
        // I want colors to be correct, even for intermediate class changes
        // (before they move annotations).
        setObj.labels.push(chip.class.label);
      }
    }

    var widget = new SAM.RectSetWidget();
    widget.Load(setObj);

    // We want to color by labels (not widget)
    var shape = widget.Shape;
    if (!shape.LabelColors) {
      shape.LabelColors = {};
      // Colors setup in contructor.
      for (i = 0; i < this.ClassObjects.length; ++i) {
        shape.LabelColors[this.ClassObjects[i].label] = this.ClassObjects[i].color;
      }
    }

    // Color by class
    //widget.Shape.SetOutlineColor(annotNode.class.color);

    this.Viewer.GetAnnotationLayer().AddWidget(widget);
  }

});

export {LightBoxView};

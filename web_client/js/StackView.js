// multiple aligned images a location over time.
import { restRequest } from 'girder/rest';
import View from 'girder/views/View';

var StackView = View.extend({
    events: {
        'contextmenu .g-render-target': '_ignore',
        'mousedown .g-render-target': '_ignore',
        'selectstart .g-render-target': '_ignore',
        'mousewheel .g-render-target': '_ignore',
	      'click .layer_div': '_element_callback',
    },

    _ignore: function () {
        return false;
    },

    initialize: function (settings) {
        console.log("StackView init");
        this.file = settings.file;
    },

    _element_callback: function(e) {
        // no action for now.
        this.e = e;
        var element = $(e.target)
    },

    // Render is really initialize. I believe it only gets called once.
    render: function () {
        console.log("StackView render");
        //console.log(JSON.stringify(this.testImage));
        var self = this;

        // Wait unitl both libraries are loaded before continuing.
        if ( typeof(SA) == "undefined" || typeof(SAM) == "undefined") {
            // Make sure we have the classes we need.
            $('head').prepend(
                $('<link rel="stylesheet" href="http://lemon:8080/webgl-viewer/static/css/sa.css">'));
            $.getScript(
                'http://lemon:8080/webgl-viewer/static/sam.max.js',
                _.bind(function () {
                    console.log("sam loaded");
                    $.getScript(
                        'http://lemon:8080/webgl-viewer/static/sa.max.js',
                        _.bind(function () {
                            console.log("sa loaded");
                            this.render();
                        }, this)
                    );
                }, this)
            );
            return;
        }

        console.log("Request mission data");
        // Get the mission info we need from the "database"/
        restRequest({
            type: 'GET',
            path: "/file/"+this.file.id+"/download"
        }).done(_.bind(function (resp) {
            this._loadMissionData(resp);
        }, this));
    },

    _getTileUrl: function (level, x, y) {
        return '/api/v1/item/' + this.itemId + '/tiles/zxy/' +
            level + '/' + x + '/' + y;
    },

    _loadMissionData: function (mission_data) {

        console.log("Load mission data");

        var self = this;
        //this.missionData = JSON.parse(mission_data);
        this.missionData = mission_data;
        this.layerViews = [];

        // Make the viewer but do not set the images yet.
        console.log("Creating viewer");
        this.viewWindow = $('<div>')
            .css({'background-color':'#FFF',
                  'position':'fixed',
                  'left':'0px',
                  'width':'100%',
                  'z-index':'100'})
            .appendTo($('body'))
            .saFullHeight();

        // Build a note for the stack.
        this.note = new SA.Note();
        this.note.Type = "Stack";

        var control_div = $('<div id="control_div">')
            .appendTo($(this.viewWindow))
            .css({ 'position':'absolute',
                   'width': '300px', 
                   'height': '100%', 
                   'float': 'left' });
        var hide = $('<div>')
            .appendTo(control_div)
            .text("X")
            .css({'color':'red',
                  'font-size':'200%',
                  'cursor':'default'})
            .click(function () {
                self.viewWindow.hide();
            });
        this.viewerDiv = $('<div>')
            .appendTo(this.viewWindow)
            .css({ 'position':'absolute',
                   'left': '300px', 
                   'right':'0px',
                   'height': '100%', 
                   'float': 'right' });

        this.requestCount = 0;
        this.detections = this.missionData.Sessions[0].detections;
        for (var i = 0; i < this.detections.length; ++i) {
            this._requestImageTileData(this.detections[i], i);
        }
    },


    _requestImageTileData: function (detection, index) {
        var imageId = detection.image_id;
        var fileName = detection.file_name || "";
        restRequest({
            type: 'GET',
            path: "/item/"+imageId+"/tiles",

        }).done(_.bind(function (resp) {
            this._loadImageTileData(index,imageId,fileName,resp);
        }, this));
    },


    _loadImageTileData: function (index,imageId,fileName,image_tile_data) {
        var self = this;

        var image = {};
        image.tileUrlRoot = "/api/v1/item/"+imageId+"/tiles/zxy/";

        var tileSource = {
            filename:fileName,
            height: image_tile_data.sizeY,
            width: image_tile_data.sizeX,
            tileSize: image_tile_data.tileHeight,
            minLevel: 0,
            maxLevel: image_tile_data.levels-1,
            getTileUrl:
            _.bind(function (a,b,c) {
                return this.tileUrlRoot+a+"/"+b+"/"+c;
            }, image),
        };

        var viewerRec = SA.TileSourceToViewerRecord(tileSource);
        viewerRec.Transform = new SA.PairTransformation();
        this.note.ViewerRecords[index] = viewerRec;

        // Add the annotations to the viewer record.
        var detection = this.detections[index];
        var layerView = this._getLayerView(detection.description);
        var image_objects = detection.image_objects;

        // Hack in a viewer label by using the copyright notice.
        viewerRec.Image.copyright = viewerRec.Image.filename;

        var USE_SET = true;
        // Put all the rectangles into one set.
        var set_obj = {};
        set_obj.type = "rect_set";
        set_obj.centers = [];
        set_obj.widths = [];
        set_obj.heights = [];
        set_obj.confidences = [];
        
        for (var i = 0; i < image_objects.length; i++){
            var corner_points = image_objects[i].corner_points;
            var width = corner_points[1] - corner_points[0];
            var height = corner_points[3] - corner_points[2];
            var tlc = [corner_points[0] + width/2, corner_points[2] + width/2];
            var scalar = image_objects[i].confidence;

            if (USE_SET) {
                set_obj.widths.push(width);
                set_obj.heights.push(height);
                set_obj.centers.push(tlc[0]);
                set_obj.centers.push(tlc[1]);
                set_obj.color = SAM.ConvertColor(layerView.Color);
                set_obj.confidences.push(scalar);
            } else {
                viewerRec.Annotations.push({type:'rect', origin:tlc,
                                            width: width, height: height, linewidth: 0,
                                            outlinecolor: layerView.Color,
                                            confidence: scalar});
            }
        }
        if (USE_SET) {
            viewerRec.Annotations.push(set_obj);
        }

        // Check to see if we have loaded all the images yet.
        this.requestCount += 1;
        if (this.requestCount == this.detections.length) {
            this.note.LoadState = 2;
            // Constructs the dual viewer.
            this.viewerDiv.saViewer({'prefixUrl': 'http://lemon:8080/webgl-viewer/static/',
                                     'dual':true, 'note':this.note});
            this.sa_dual_viewer = this.viewerDiv[0].saViewer;

            // hack to get layerview working with stack.
            // Assume only one layer.
            this.layerViews[0].AddLayer(this.sa_dual_viewer.Viewers[0].Layers[0]);
            this.layerViews[0].AddLayer(this.sa_dual_viewer.Viewers[1].Layers[0]);
            this.sa_dual_viewer.UpdateSize();
        }
    },

    // To support sharing layers.
    _getLayerView: function (label) {
        for (var i = 0; i < this.layerViews.length; ++i) {
            layerView = this.layerViews[i];
            if (layerView.Label == label) {
                return layerView;
            }
        }
        // Make a new layer view.
        var layerView = new SA.LayerView($('#control_div'), label);
        this.layerViews.push(layerView);
        return layerView;
    },
});

export {StackView};

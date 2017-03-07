// See if we cn get the heat map working.


girder.views.PlanetView = girder.View.extend({
    events: {
        'contextmenu .g-render-target': '_ignore',
        'mousedown .g-render-target': '_ignore',
        'selectstart .g-render-target': '_layerignore',
        'mousewheel .g-render-target': '_ignore',
	      'click .layer_div': '_element_callback',
    },

    _ignore: function () {
        return false;
    },

    initialize: function (settings) {
        console.log("initialize");
        this.file = settings.file;
    },

    _element_callback: function(e) {
        // no action for now.
        this.e = e;
        var element = $(e.target)
    },

    // Render is really initialize. I believe it only gets called once.
    render: function () {
        console.log("render");
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

        console.log("Load mission data");

        // Get the mission info we need from the "database"/
        girder.restRequest({
            type: 'GET',
            path: "/file/"+this.file.id+"/download"
        }).done(_.bind(function (resp) {
            this._loadMissionData(resp);
        }, this));
    },

    _loadMissionData: function (mission_data) {
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

        //this.$el.html(girder.templates.container({}));
        //$('#g_container').css({"height": "600px"});
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
        var viewer_div = $('<div>')
            .appendTo(this.viewWindow)
            .css({ 'position':'absolute',
                   'left': '300px', 
                   'right':'0px',
                   'height': '100%', 
                   'float': 'right' });

        // Constructs the double viewer.
        //viewer_div.saViewer();
        //this.sa_viewer = viewer_div[0].saViewer;

        // ignore image id and fake a planet lab tile source.
        var self = this;
        // TODO: Make this image the tile source ....
        var image = {};
        image.tileUrlRoot = "https://pm4.planet-labs.com/open_california_re_20130901_20131130/gmap/";
        // 5235/12665
        viewer_div.saViewer({
            zoomWidget: true,
            drawWidget: true,
            prefixUrl: 'http://lemon:8080/webgl-viewer/static/',
            tileSource: {
                height: 3389440,
                width: 1528320,
                bounds: [1340160-10000,1340160+10000, 3242240-20000, 3242240+20000],
                tileSize: 256,
                minLevel: 0,
                maxLevel: 15,
                getTileUrl: _.bind(function (z,x,y) {
                    return this.tileUrlRoot+z+"/"+x+"/"+y+".png";
                }, image),
                ajaxWithCredentials: true
            }});
        this.sa_viewer = viewer_div[0].saViewer;
        this.sa_viewer.SetCamera([1340160,3242240], 0, 4900);
        //this._initImage(index,imageId);

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


    // TODO: Find all detections for this image an load it as a layer.
    // TODO: Share GUI for layers (in different images) with the same name.
    _initImage: function (viewIndex,imageId) {
        var data = this.missionData;

        console.log("Loading annotations");

        // How should I handle annotations when the viewers are in the same
        // window? When I turn off on view, the annotations should go with
        // it. SHould I allow layers to have layers?
        // Put them into the master viewer for now..
        var viewer = this.sa_viewer;
        /*
        var detections = this.missionData.Sessions[0].detections;
        for (var detection_idx = 0; detection_idx < detections.length; ++detection_idx) {
            if (detections[detection_idx].image_id == imageId) {

                var detection = detections[detection_idx];
                var sa_layer = viewer.NewAnnotationLayer();
                var layerView = this._getLayerView(detection.description);

                // Create the annotations in the layer.
                var image_objects = detection.image_objects;
                for (var index = 0; index < image_objects.length; index++){
                    var corner_points = image_objects[index]["corner_points"];

                    var width = corner_points[1] - corner_points[0];
                    var height = corner_points[3] - corner_points[2];
                    var tlc = [corner_points[0] + width/2, corner_points[2] + width/2];

                    // TODO: Random or saved color
                    var sa_rect = sa_layer.LoadWidget({type:'rect', origin:tlc,
                                                       width: width, height: height, linewidth: 0,
                                                       outlinecolor: layerView.Color});
                    sa_rect.confidence = image_objects[index]["confidence"];
                    sa_rect.Visibility = true;
                }
                layerView.AddLayer(sa_layer);
                sa_layer.EventuallyDraw();
            }
        }*/
    },

});


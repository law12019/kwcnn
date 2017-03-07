import { staticRoot } from 'girder/rest';
import { restRequest } from 'girder/rest';
import View from 'girder/views/View';


// multiple images
// SOrt detection annotation rectangles into arbitrary classes
var GroundTruthView = View.extend({
    initialize: function (settings) {
        this.settings = settings;
        this.groundTruthInfo = settings.metaData;

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

        // Get the image id from the json file.
        // Request the large image meta data from girder.
        this._requestImageTileData(this.groundTruthInfo.image_id);
    },

    _requestImageTileData: function (imageId) {
        var self = this;
        restRequest({
            type: 'GET',
            path: "/item/"+imageId+"/tiles",
        }).done(function (resp) {
            self._loadImageTileData(imageId,resp);
        });
    },

    _loadImageTileData: function (imageId,image_tile_data) {
        var self = this;

        var image = {};
        image.tileUrlRoot = "/api/v1/item/"+imageId+"/tiles/zxy/";

        var tileSource = {
            filename:"",
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

        // Build a note for the stack.
        this.note = new SA.Note();
        this.note.Type = "Note";
        this.note.ViewerRecords[0] = viewerRec;
        this.note.LoadState = 2;

        // Make the viewer but do not set the image yet.
        this.viewWindow = $('<div>')
            .css({'background-color':'#FFF',
                  'position':'fixed',
                  'left':'0px',
                  'width':'100%',
                  'z-index':'100'})
            .appendTo($('body'));
            //.saFullHeight();
        SA.SAFullHeight(this.viewWindow);

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
              console.log("Close viewer");
              // Viewer is not closing properly (intermitent).
              SA.DEBUG = self.viewWindow;
              //self.viewWindow.remove();
              // I am getting multiple views.  Hack. Close them all.
              $('.sa-full-height').remove();
            });
        this.viewerDiv = $('<div>')
            .appendTo(this.viewWindow)
            .css({ 'position':'absolute',
                   'left': '300px',
                   'right':'0px',
                   'height': '100%',
                   'float': 'right' });

        if ( $('.sa-viewer').length > 1) {
          //consider returning early.
          console.log("A viewer already exists");
        }
        SA.SAViewer(this.viewerDiv, {prefixUrl: staticRoot + '/built/plugins/large_image/extra/slideatlas/img/',
                                     dual:false, drawWidget:false, zoomWidget:true, 
                                     rotatable:false, note:this.note});
        this.sa_viewer = this.viewerDiv[0].saViewer;
        this.sa_viewer.MinPixelSize = 0.25;

        // Now create the ground truth GUI.
        this.groundTruthGui = new SAM.GirderAnnotationEditor(control_div,
                                                             this.sa_viewer.GetAnnotationLayer(),
                                                             this.groundTruthInfo.image_id,
                                                             this.groundTruthInfo.classes);
        this.sa_viewer.UpdateSize();
    },
});

export {GroundTruthView};

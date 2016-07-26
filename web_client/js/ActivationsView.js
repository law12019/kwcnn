

girder.views.kwcnn_ActivationsView = girder.View.extend({
    events: {
        'contextmenu .g-render-target': '_ignore',
        'mousedown .g-render-target': '_ignore',
        'selectstart .g-render-target': '_ignore',
        'mousewheel .g-render-target': '_ignore',
    },

    _ignore: function () {
        return false;
    },

    initialize: function (settings) {
        this.file = settings.file;
    },

    render: function () {
        //console.log(JSON.stringify(this.testImage));
        // todo: use underscore for this
        var self = this;
        // We could look for the file name in "this.files.models"
        // We could also have all the  file ids in som json structure.  The
        // first file in the item.  Hard code the json file id for now.
        $.ajax({
            type: "get",
            url: this.file.downloadUrl(),
            success: function(data,status) {
                console.log(data);
                self._initActivations(data);
            },
            error: function() {
                alert("json file failed");
            }
        });
    },

    _initActivations: function (data) {
        this.data = data;
        console.log(JSON.stringify(data));
        this.$el.html(girder.templates.kwcnn_activations(
            {image_ids: data}));
        for(var i = 0; i < this.data.length; i++){
            $('<img>')
                .appendTo($('#g_activation_container'))
                .attr("src", "/api/v1/file/"+this.data[i]+"/download");
        }
    },

});


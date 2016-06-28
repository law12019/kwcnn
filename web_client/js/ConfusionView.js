girder.views.kwcnn_ConfusionView = girder.View.extend({
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
        this.testImage = settings.testImage;
        this.item = settings.item;
    },

    render: function () {
        console.log(JSON.stringify(this.testImage));
        // todo: use underscore for this
        var self = this;
        // We could look for the file name in "this.files.models"
        // We could also have all the  file ids in som json structure.  The
        // first file in the item.  Hard code the json file id for now.
        $.ajax({
            type: "get",
            url: this.file.downloadUrl(),
            success: function(data,status) {
                self._initConfusion(JSON.parse(data));
            },
            error: function() {
                alert("json file failed");
            },
        });
    },

    _initConfusion: function (data) {
        this.$el.html(girder.templates.kwcnn_confusion(
            {matrix: data.matrix,
             image_url: this.testImage}));
        console.log(JSON.stringify(data));
        $('<div>')
            .appendTo(this.$el)
            .text(JSON.stringify(data));
    },

});

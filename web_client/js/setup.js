girder.wrap(girder.views.ItemView, 'initialize', function (initialize, settings) {
    initialize.call(this, settings);
    this.on('g:rendered', function () {
        var meta = this.model.get('meta') || {};
        var fileColl = this.fileListWidget.collection;

        var initKwcnnView = _.bind(function () {
            // Make a container div for all the kwcnn views to populate.
            var el = $('<div>', {
                class: 'g-kwcnn-container'
            }).prependTo(this.$('.g-item-info'));
            // Look through the files in the item to find json that create
            // views.
            var files = this.fileListWidget.collection.models;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.name() == "confusion.json") {
                    new girder.views.kwcnn_ConfusionView({
                        file: file,
                        testImage: files[1].downloadUrl(),
                        parentView: this,
                        item: this.model,
                        el: el
                    }).render();
                }
            }
        }, this);


        if (_.has(meta, 'kwcnn')) {
             console.log('kwcnn');
            initKwcnnView();
        }
    }, this);
});













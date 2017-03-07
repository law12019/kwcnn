import _ from 'underscore';
import { wrap } from 'girder/utilities/PluginUtils';
import ItemView from 'girder/views/body/ItemView';
import View from 'girder/views/View';
import {GroundTruthView} from './GroundTruthView';
import {LightBoxView} from './LightBoxView';
import {StackView} from './StackView';


wrap(ItemView, 'initialize', function (initialize, settings) {
  initialize.call(this, settings);
  this.on('g:rendered', function () {
    var meta = this.model.get('meta') || {};
    // var fileColl = this.fileListWidget.collection;

    var initGroundTruthView = _.bind(function (metaData) {
      // Make a top level container
      var el = $('<div>', {
        class: 'g-kwcnn-container'
      }).prependTo(this.$('.g-item-info'));
      new GroundTruthView({
        metaData: metaData,
        parentView: this,
        item: this.model,
        el: el
      }).render();
    }, this);

    var initLightBoxView = _.bind(function (metaData) {
      // Make a top level container
      var el = $('<div>', {
        class: 'g-kwcnn-container'
      }).prependTo(this.$('.g-item-info'));

      new LightBoxView({
        metaData: metaData,
        parentView: this,
        item: this.model,
        el: el
      }).render();
    }, this);

    var initView = _.bind(function (viewType) {
      // Make a container div for all the kwcnn views to populate.
      var el = $('<div>', {
        class: 'g-kwcnn-container'
      }).prependTo(this.$('.g-item-info'))
        .css("height", "600px");

      // Look through the files in the item to find json that create
      // views.
      var files = this.fileListWidget.collection.models;
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        console.log(file.name());
        if (file.name().split('.')[1] == "json") {
          console.log(viewType);
          if (viewType == "Stack") {
            new StackView({
              file: file,
              parentView: this,
              item: this.model,
              el: el
            }).render();
          } /* else if (viewType == "Dual") {
               new girder.views.DualView({
               file: file,
               parentView: this,
               item: this.model,
               el: el
               }).render();
               } else if (viewType == "Double") {
               new girder.views.DoubleView({
               file: file,
               parentView: this,
               item: this.model,
               el: el
               }).render();
               } else if (viewType == "Overlay") {
               console.log("Overlay");
               new girder.views.OverlayView({
               file: file,
               parentView: this,
               item: this.model,
               el: el
               }).render();
               } else if (viewType == "HeatMap") {
               console.log("HeatMap");
               new girder.views.HeatMapView({
               file: file,
               parentView: this,
               item: this.model,
               el: el
               }).render();
               } else if (viewType == "Planet") {
               console.log("Planet");
               new girder.views.PlanetView({
               file: file,
               parentView: this,
               item: this.model,
               el: el
               }).render();
               }*/
        }
      }
    }, this);

    if (_.has(meta, 'VigilantChangeDetection')) {
      console.log('Vigilant change detection plugin activated');
      initView(meta.VigilantChangeDetection);
    }

    if (_.has(meta, 'GroundTruth')) {
      console.log('Vigilant change detection plugin activated');
      initGroundTruthView(meta.GroundTruth);
    }

    if (_.has(meta, 'LightBox')) {
      console.log('Vigilant change detection plugin activated');
      initLightBoxView(meta.LightBox);
    }
  }, this);
});











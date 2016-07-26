

girder.views.olcd_ActivationsView = girder.View.extend({
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
        this.file = settings.file;
    },

    _element_callback: function(e) {
        this.e = e;
        //console.log(JSON.stringify(e));
        //$('#image_display').empty();

        var element = $(e.target)
        var layer_id_str = element.attr('id');
        var layer = parseInt(layer_id_str.slice(5));

        //element.html("CLICKED!");
        //console.log(layer_id_str);
        //console.log(this.data[layer])

        //data_string = element.attr('info');

        $('#layer' + layer + 'data').show();
    },

    render: function () {
        //console.log(JSON.stringify(this.testImage));
        var self = this;

        $.ajax({
            type: "get",
            url: self.file.downloadUrl(),
            success: function(data, status) {
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
        //console.log(JSON.stringify(data));

        //model_html = "";
        //for (var i = 0; i < this.data.length; i++){
        //    model_html += "<div id='layer" + i + "'><\div>
        //}

        this.$el.html(girder.templates.olcd_activations(
            {image_ids: this.data[0]}));

        $('<img>')
            .appendTo($('#g_activation_container'))
            .attr("src", "/api/v1/file/"+this.data['obscuration_img_id']+"/download");

        for(var i = 0; i < this.data['description'].length; i++){
            $('<div>')
                .appendTo($('#g_activation_container'))
                .attr("src", "/api/v1/file/"+this.data['description'][i]+"/download")
                .attr("id", "layer" + i)
                .attr("class", "layer_div")
                .attr("info", this.data['description'][i])
                .html("Layer " + i + ": " + this.data['description'][i]["type"])
                .css("border: 1px solid black");
            
            $('<div>')
                .appendTo($('#layer' + i))
                .attr("id", "layer" + i + "data")
                .html(JSON.stringify(this.data['description'][i]))
                .hide();

            $('</br>')
                .appendTo($('#layer'+i+'data'));
        }

        // Layer index
        for (var i = 0; i < this.data['activation_image_ids'].length; i++) {
            // Image index
            for (var j = 0; j < this.data['activation_image_ids'][i].length; j++) {
                // Filter index
                for (var k = 0; k < this.data['activation_image_ids'][i][j].length; k++) {
                    $('<img>')
                        .appendTo($('#layer'+i+'data'))
                        .attr("src", "/api/v1/file/"+this.data['activation_image_ids'][i][j][k]+"/download");
                }
                $('</br>')
                    .appendTo($('#layer'+i+'data'));
            }
        }
    },

});


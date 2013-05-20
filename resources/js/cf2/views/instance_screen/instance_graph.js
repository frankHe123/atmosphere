/**
 * View for displaying stacked charts for CPU and Load
 */
Atmo.Views.InstanceGraph = Backbone.View.extend({
    initialize: function(options) {
        this.stop = new Date();
        this.range = 7*24*60*60*1000; // seven days
        this.start = new Date(this.stop.valueOf() - this.range);

        var provider_id = Atmo.profile.get('selected_identity').get('provider_id')
        this.selected_provider = Atmo.providers.get(provider_id)
        $(window).bind('resize', _.bind(this.draw, this));
        this.data = null;

        this.on_failure = this.options.on_failure;
    },
    render: function() {
        this.$el
            .append($("<div>", {id: "chart-" + this.type + '-' + this.model.get('id')}).css('height', '220px'))
            .append($("<div>", {id: "control-" + this.type + '-' + this.model.get('id')}).css('height', '40px'));
        return this;
    },
    data_request: function(type, callback) {
        if (this.data != null)
            callback(this.data);
        else {
            var self = this;
            $.ajax({
                url: site_root + '/api/metrics',
                data: {
                    id: this.model.get('id'),
                    provider: this.selected_provider.get('type'),
                    from: '-7d',
                    type: type
                },
                type: 'GET',
                dataType: 'json',
                success: function(data, textStatus) {
                    self.data = data;
                    if (self.data.length >= 3) 
                        callback(self.data);
                    else
                        self.on_failure();
                },
                error: function() {
                    self.on_failure();
                }
            });
        }
    },
    draw_chart: function() {
        this.dashboard = new google.visualization.Dashboard(this.el);

        //console.log('LOOK AT ME', this.start, this.stop);

        var control = new google.visualization.ControlWrapper({
            'controlType': 'ChartRangeFilter',
            'containerId': 'control-' + this.type + '-' + this.model.get('id'),
            'options': {
                // Filter by the date axis.
                'filterColumnIndex': 0,
                'ui': {
                    'chartType': 'LineChart',
                    'chartOptions': {
                        'chartArea': {'width': '80%'},
                        'hAxis': {'baselineColor': 'none'},
                        'vAxis': {'maxValue': 1, 'minValue': 0},
                        'backgroundColor': 'transparent',
                        'interpolateNulls': true
                    },
                    // Display a single series that shows the closing value of the stock.
                    // Thus, this view has two columns: the date (axis) and the stock value (line series).
                    'chartView': {
                        'columns': [0, 1]
                    },
                    // 1 hour in milliseconds = 60 * 60 * 1000 = 36e5
                    'minRangeSize': 36e5
                }
            },
            'state': {'range': {'start': this.start, 'end': this.stop}}
        });

        var chart = new google.visualization.ChartWrapper({
            'chartType': 'SteppedAreaChart',
            'containerId': 'chart-' + this.type + '-' + this.model.get('id'),
            'options': {
                // Use the same chart area width as the control for axis alignment.
                'isStacked': true,
                'chartArea': {'height': '80%', 'width': '80%'},
                'hAxis': {'slantedText': false},
                'vAxes': {
                    "0": {'title': this.vaxis_title}
                },
                'legend': {'position': 'top'},
                'backgroundColor': 'transparent',
                'interpolateNulls': true
            },
            // Convert the first column from 'date' to 'string'.
            'view': {
                'columns': [
                    {
                        'calc': function(dataTable, rowIndex) {
                             return dataTable.getFormattedValue(rowIndex, 0);
                        },
                        'type': 'string'
                    }, 1, 2, 3
                ]
            }
        });

        var self = this;
        this.data_request(this.type, function(data) {
            //console.log(data); 
            self.table = new google.visualization.DataTable();
            self.table.addColumn('date', 'Date');
            _.each(self.columns, function(d) {
                self.table.addColumn(d[0], d[1]);
            });

            var rows = _.map(data, self.format_rows);
            
            self.table.addRows(rows);

            var date_formatter = new google.visualization.DateFormat({pattern: 'MMM d h:mm a'});
            date_formatter.format(self.table, 0);

            self.dashboard.bind(control, chart);
            self.dashboard.draw(self.table);
        });
    },
    draw: function() {
        if (this.dashboard)
            this.dashboard.draw(this.table);
    }
});

Atmo.Views.InstanceMemoryGraph = Atmo.Views.InstanceGraph.extend({
    type: 'memory',
    vaxis_title: 'Memory (MB)',
    columns: [
        ['number', 'Active'], 
        ['number', 'Inactive'], 
        ['number', 'Free']
    ],
    format_rows: function(d) {
        return [
            new Date(d.time * 1000), 
            d['memory.active'] / 1024, 
            d['memory.inactive'] / 1024, 
            d['memory.free'] / 1024
        ];
    }
});

Atmo.Views.InstanceCPUGraph = Atmo.Views.InstanceGraph.extend({
    type: 'cpu',
    vaxis_title: 'CPU time (%)',
    columns: [
        ['number', 'User'], 
        ['number', 'System'], 
        ['number', 'Idle'], 
        ['number', 'Waiting for IO']
    ],
    format_rows: function(d) {
        return [
            new Date(d.time * 1000),
            d['cpu.user'],
            d['cpu.system'],
            d['cpu.idle'],
            d['cpu.waiting']
        ];
    }
});

window.ViewsView = countlyView.extend({
    selectedMetric:"u",
    selectedView:null,
    selectedViews:[],
	selectedApps: {all:true},
	selectedCount: 0,
    ids:{},
    lastId:0,
    token: false,
    useView: null,
    beforeRender: function() {
			var self = this;
			return $.when($.get(countlyGlobal["path"]+'/views/templates/views.html', function(src){
				self.template = Handlebars.compile(src);
			}), countlyViews.initialize()).then(function () {});
    },
    getProperties: function(metric){
        return {
            "u":jQuery.i18n.map["common.table.total-users"],
            "n":jQuery.i18n.map["common.table.new-users"],
            "t":jQuery.i18n.map["views.total-visits"],
            "d":jQuery.i18n.map["views.duration"],
            "s":jQuery.i18n.map["views.starts"],
            "e":jQuery.i18n.map["views.exits"],
            "b":jQuery.i18n.map["views.bounces"] 
        }
    },
    renderCommon:function (isRefresh) {
        var self = this;
        var data = countlyViews.getData();
        var props = this.getProperties();
        var usage = [];
        
        for(var i in props){
            usage.push({
                    "title":props[i],
                    "id":"view-metric-"+i
                });
        }
        
        var domains = countlyViews.getDomains();
        for(var i = 0; i < domains.length; i++){
            domains[i] = countlyCommon.decode(domains[i]);
        }

        this.templateData = {
            "page-title":jQuery.i18n.map["views.title"],
            "font-logo-class":"fa-eye",
            "active-segmentation": jQuery.i18n.map["views.all-segments"],
            "segmentations": countlyViews.getSegments(),
            "usage":usage,
            "domains":domains
        };

        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
            
            var columns = [
                { "mData": function(row, type){if(type == "display"){ return row.views+"<div class='color'></div>";} else return row.views;}, sType:"string", "sTitle": jQuery.i18n.map["views.table.view"] , "sClass": "break", "sWidth": "30%"},
                { "mData": "u", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["common.table.total-users"] },
                { "mData": "n", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["common.table.new-users"] },
                { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["views.total-visits"] },
                { "mData": function(row, type){
                    var time = (row.d == 0 || row.t == 0) ? 0 : row.d/row.t;
                    if(type === "display") return countlyCommon.timeString(time/60);
                    else return time}, sType:"numeric", "sTitle": jQuery.i18n.map["views.avg-duration"] },
                { "mData": "s", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["views.starts"] },
                { "mData": "e", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["views.exits"] },
                { "mData": "b", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["views.bounces"] }
            ];
            
            if(typeof addDrill != "undefined"){
                $(".widget-header .left .title").after(addDrill("sg.name", null, "[CLY]_view"));
                if(countlyGlobal["apps"][countlyCommon.ACTIVE_APP_ID].type == "web" && domains.length){
                    columns.push({ "mData": function(row, type){
                        var url = "#/analytics/views/action-map/";
                        if(countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID]["app_domain"] && countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID]["app_domain"].length > 0){
                            url = countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID]["app_domain"];
                            if(url.indexOf("http") !== 0)
                                url = "http://"+url;
                            if(url.substr(url.length - 1) == '/') 
                                url = url.substr(0, url.length - 1);
                        }

                        return '<a href='+url+row.views+' class="table-link green" data-localize="views.table.view" style="margin:0px; padding:2px;">'+jQuery.i18n.map["views.table.view"]+'</a>';
                        }, sType:"string", "sTitle": jQuery.i18n.map["views.action-map"], "sClass":"shrink center", bSortable: false });
                }
            }

            this.dtable = $('.d-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": data.chartData,
                "fnRowCallback": function( nRow, aData, iDisplayIndex, iDisplayIndexFull ) {
                    if(!self.selectedView){
                        self.selectedView = aData.views;
                        self.selectedViews.push(self.selectedView);
                    }
                    
                    if(!self.ids[aData.views]){
                        self.ids[aData.views] = "view_"+self.lastId;
                        self.lastId++;
                    }
                    $(nRow).attr("id", self.ids[aData.views]);
                },
                "aoColumns": columns
            }));

            $(".d-table").stickyTableHeaders();
            this.dtable.fnSort( [ [1,'desc'] ] );
            $(".dataTable-bottom").append("<div class='dataTables_info' style='float: right;'>"+jQuery.i18n.map["views.maximum-items"]+" ("+countlyCommon.GRAPH_COLORS.length+")</div>")
            
            $('.views-table tbody').on("click", "tr", function (event){
                var row = $(this);
                
                self.selectedView = row.find("td").first().text();

                var persistentSettings = countlyCommon.getPersistentSettings()["pageViewsItems_" + countlyCommon.ACTIVE_APP_ID] || [];

                if(_.contains(self.selectedViews, self.selectedView)){
                    var index = self.selectedViews.indexOf(self.selectedView);
                    self.selectedViews.splice(index, 1);
                    persistentSettings.splice(persistentSettings.indexOf(self.selectedView), 1);
                    row.find(".color").css("background-color", "transparent");
                }
                else if(self.selectedViews.length < countlyCommon.GRAPH_COLORS.length){
                    self.selectedViews.push(self.selectedView);
                    persistentSettings.push(self.selectedView);
                }
                
                var persistData = {};
                persistData["pageViewsItems_" + countlyCommon.ACTIVE_APP_ID] = persistentSettings;
                countlyCommon.setPersistentSettings(persistData);

                if(self.selectedViews.length == 0)
                    $("#empty-graph").show();
                else
                    $("#empty-graph").hide();
                self.drawGraph();
            });
            
            $('.views-table tbody').on("click", "a.table-link", function (event){
                event.stopPropagation();
                var followLink = false;
                var url = event.target.href;

                if(url.indexOf("#/analytics/views/action-map/") < 0){
                    followLink = true;
                }

                if(countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].sdk_version && parseInt((countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].sdk_version+"").split(".")[0]) <= 16){
                    return;
                }
                $(event.target).toggleClass("active");
                if($(event.target).hasClass("active")){
                    $(".views-table a.table-link").removeClass("active");
                    $(event.target).addClass("active");
                    
                    if(!followLink){
                        var pos = $(event.target).offset();
                        $('.widget-content .cly-button-menu').css({
                            top: (pos.top+25) + "px",
                            left: (pos.left-250) + "px",
                            right: 35 + "px"
                        });
                        $('.widget-content > .cly-button-menu-trigger').addClass("active");
                        $('.widget-content > .cly-button-menu').focus();
                    }

                    var newWindow = "";
                    if(followLink){
                        newWindow = window.open("");
                    }

                    countlyViews.getToken(function(token){
                        self.useView = event.target.hash;
                        self.token = token;

                        if(followLink && (self.token !== false)){
                            newWindow.location.href = url;
                            newWindow.name = "cly:" + JSON.stringify({"token":self.token,"purpose":"heatmap",period:countlyCommon.getPeriodForAjax(),showHeatMap: true});    
                        }
                    });
                }
                else{
                    $(event.target).removeClass("active");
                    $('.widget-content > .cly-button-menu-trigger').removeClass("active");
                }
                event.preventDefault();
            });
            
            $('.widget-content .cly-button-menu .item').click(function(event){
                var url = $(event.target).text();
                if(url.indexOf("http") !== 0)
                    url = "http://"+url;
                if(url.substr(url.length - 1) == '/') {
                    url = url.substr(0, url.length - 1);
                }
                if(self.token !== false){
                    var path = self.useView.replace("#/analytics/views/action-map/", "");
                    window.open(url+path, "cly:" + JSON.stringify({"token":self.token,"purpose":"heatmap",period:countlyCommon.getPeriodForAjax(),showHeatMap: true}));
                }
                $('.widget-content > .cly-button-menu-trigger').removeClass("active");
            });

            $('.widget-content .cly-button-menu').blur(function() {
                $('.widget-content > .cly-button-menu-trigger').removeClass("active");
            });
            
            $("#view-metric-"+this.selectedMetric).parents(".big-numbers").addClass("active");
            
            $(".widget-content .inner").click(function () {
                $(".big-numbers").removeClass("active");
                $(".big-numbers .select").removeClass("selected");
                $(this).parent(".big-numbers").addClass("active");
                $(this).find('.select').addClass("selected");
            });
            
            $(".segmentation-option").on("click", function () {
                countlyViews.reset();
				countlyViews.setSegment($(this).data("value"));
                self.refresh();
			});
    
            $(".big-numbers .inner").click(function () {
                var elID = $(this).find('.select').attr("id").replace("view-metric-", "");
    
                if (self.selectedMetric == elID) {
                    return true;
                }
    
                self.selectedMetric = elID;
                self.drawGraph();
            });
            
            var persistentSettings = countlyCommon.getPersistentSettings()['pageViewsItems_' + countlyCommon.ACTIVE_APP_ID] || [];
            if(persistentSettings.length === 0){
                for(var i in self.selectedViews){
                    persistentSettings.push(self.selectedViews[i]);
                }

                var persistData = {};
                persistData["pageViewsItems_" + countlyCommon.ACTIVE_APP_ID] = persistentSettings;
                countlyCommon.setPersistentSettings(persistData);
            }else{
                self.selectedViews = [];
                
                for(var i in persistentSettings){
                    var current = persistentSettings[i];

                    if(self.selectedViews.indexOf(current) < 0)
                        self.selectedViews.push(current)
                }
            }

            $("#view-metric-"+this.selectedMetric).parents(".big-numbers").addClass("active");
            
            this.drawGraph();
        }
    },
    drawGraph: function(){
        var props = this.getProperties();
        var dp = [];
        for(var i = 0;  i < this.selectedViews.length; i++){
            var color = countlyCommon.GRAPH_COLORS[i];
            var data = countlyViews.getChartData(this.selectedViews[i], this.selectedMetric, props[this.selectedMetric]).chartDP;
            data[1].color = color;
            $("#"+this.ids[this.selectedViews[i]]+" .color").css("background-color", color);
            if(this.selectedViews.length == 1){
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                data[0].color = "rgba("+parseInt(result[1], 16)+","+parseInt(result[2], 16)+","+parseInt(result[3], 16)+",0.5"+")";
                dp.push(data[0])
            }
            dp.push(data[1]);
        }
        countlyCommon.drawTimeGraph(dp, "#dashboard-graph");
    },
    refresh:function () {
        var self = this;
        $.when(countlyViews.refresh()).then(function () {
            if (app.activeView != self) {
                return false;
            }
            self.renderCommon(true);

            newPage = $("<div>" + self.template(self.templateData) + "</div>");
        
            $(self.el).find(".dashboard-summary").replaceWith(newPage.find(".dashboard-summary"));

            var data = countlyViews.getData();
            CountlyHelpers.refreshTable(self.dtable, data.chartData);
            self.drawGraph();
        });
    }
});

window.ViewFrequencyView = countlyView.extend({
    beforeRender: function() {
        return $.when(countlySession.initialize()).then(function () {});
    },
    renderCommon:function (isRefresh) {
        var durationData = countlyViews.getViewFrequencyData();

        this.templateData = {
            "page-title":jQuery.i18n.map["views.view-frequency"],
            "font-logo-class":"fa-eye"
        };

        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));

            countlyCommon.drawGraph(durationData.chartDP, "#dashboard-graph", "bar");

            this.dtable = $('.d-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": durationData.chartData,
                "aoColumns": [
                    { "mData": "vc", sType:"view-frequency", "sTitle": jQuery.i18n.map["views.view-frequency"] },
                    { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["common.number-of-sessions"] },
                    { "mData": "percent", "sType":"percent", "sTitle": jQuery.i18n.map["common.percent"] }
                ]
            }));

            $(".d-table").stickyTableHeaders();
            
        }
    },
    refresh:function () {
        var self = this;
        $.when(countlySession.initialize()).then(function () {
            if (app.activeView != self) {
                return false;
            }

            var durationData = countlyViews.getViewFrequencyData();
            countlyCommon.drawGraph(durationData.chartDP, "#dashboard-graph", "bar");
            CountlyHelpers.refreshTable(self.dtable, durationData.chartData);
        });
    }
});

window.ActionMapView = countlyView.extend({
    actionType: "",
    curSegment: 0,
    curRadius: 1,
    curBlur: 1,
    baseRadius: 1,
    baseBlur: 1.6,
    beforeRender: function() {
        var self = this;
        return $.when($.get(countlyGlobal["path"]+'/views/templates/actionmap.html', function(src){
			self.template = Handlebars.compile(src);
		}), countlyViews.loadActionsData(this.view)).then(function () {});
    },
    getData: function(data){
        var heat = [];
        var point;
        var width = $("#view-canvas-map").prop('width');
        var height = $("#view-canvas-map").prop('height');
        for(var i = 0; i < data.length; i++){
            point = data[i].sg;
            if(point.type == this.actionType)
                heat.push([parseInt((point.x/point.width)*width), parseInt((point.y/point.height)*height), data[i].c])
        }
        return heat;
    },
    getMaxHeight: function(data){
        var width = $("#view-map").width();
        var lowest = {w:0, h:0};
        var highest = {w:100000, h:5000};
        for(var i = 0; i < data.length; i++){
            if(width == data[i].sg.width)
                return data[i].sg.height;
            else if(width > data[i].sg.width && lowest.w < data[i].sg.width){
                lowest.w = data[i].sg.width;
                lowest.h = data[i].sg.height;
            }
        }

        if(lowest.h > 0)
            return lowest.h;
        
        for(var i = 0; i < data.length; i++){
            if(width < data[i].sg.width && highest.w > data[i].sg.width){
                highest.w = data[i].sg.width;
                highest.h = data[i].sg.height;
            }
        }
        
        return highest.h;
    },
    getResolutions: function(data){
        var res = ["Normal", "Fullscreen", "320x480","480x800"];
        return res;
    },
    resize: function(){
        $('#view-canvas-map').prop('width', $("#view-map").width());
        $('#view-canvas-map').prop('height', $("#view-map").height());
        if(this.map)
            this.map.resize();
    },
    loadIframe: function(){
        var self = this;
        var segments = countlyViews.getActionsData().domains;
        var url = "http://"+segments[self.curSegment]+self.view;
        if($("#view_loaded_url").val().length == 0)
            $("#view_loaded_url").val(url);
        countlyViews.testUrl(url, function(result){
            if(result){
                $("#view-map iframe").attr("src", url);
                $("#view_loaded_url").val(url);
            }
            else{
                self.curSegment++;
                if(segments[self.curSegment]){
                    self.loadIframe();
                }
                else{
                    $("#view_loaded_url").show();
                    CountlyHelpers.alert(jQuery.i18n.map["views.cannot-load"], "red");
                }
            }
        });
    },
    renderCommon:function (isRefresh) {
        var data = countlyViews.getActionsData();
        this.actionType = data.types[0] || jQuery.i18n.map["views.select-action-type"];
        var segments = countlyViews.getSegments();
        var self = this;
        this.templateData = {
            "page-title":jQuery.i18n.map["views.action-map"],
            "font-logo-class":"fa-eye",
            "first-type":this.actionType,
            "active-segmentation": jQuery.i18n.map["views.all-segments"],
            "segmentations": segments,
            "resolutions": this.getResolutions(),
            "data":data
        };

        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
            $("#view-map").height(this.getMaxHeight(data.data));
            this.resize();
            this.loadIframe();
            this.map = simpleheat("view-canvas-map");
            this.map.data(this.getData(data.data));
            this.baseRadius = Math.max((48500-35*data.data.length)/900, 5);
            this.drawMap();

            app.localize();

            $("#view_reload_url").on("click", function () {
				$("#view-map iframe").attr("src", "/o/urlload?url="+encodeURIComponent($("#view_loaded_url").val()));
			});
            
            $("#view_loaded_url").keyup(function(event){
                if(event.keyCode == 13){
                    $("#view_reload_url").click();
                }
            });
            
            $("#radius").on("change", function(){
                self.curRadius = parseInt($("#radius").val())/10;
                self.drawMap();
            });
            
            $("#blur").on("change", function(){
                self.curBlur = parseInt($("#blur").val())/10;
                self.drawMap();
            });
            
            $("#action-map-type .segmentation-option").on("click", function () {
				self.actionType = $(this).data("value");
                self.refresh();
			});
            
            $("#action-map-resolution .segmentation-option").on("click", function () {
                switch ($(this).data("value")) {
                    case "Normal":
                        $("#view-map").width("100%");
                        $("#view-map").prependTo("#view-map-container");
                        break;
                    case "Fullscreen":
                        $("#view-map").width("100%");
                        $("#view-map").prependTo(document.body);
                        break;
                    default:
                        var parts = $(this).data("value").split("x");
                        $("#view-map").width(parts[0]+"px");
                        $("#view-map").prependTo("#view-map-container");
                }
				self.resize();
                self.refresh();
			});
            
            $("#view-segments .segmentation-option").on("click", function () {
                countlyViews.reset();
				countlyViews.setSegment($(this).data("value"));
                self.refresh();
			});
        }
    },
    drawMap:function(){
        this.map.radius(this.baseRadius*this.curRadius, this.baseRadius*this.baseBlur*this.curBlur);
        this.map.draw();
    },
    refresh:function () {
        var self = this;
        $.when(countlyViews.loadActionsData(this.view)).then(function () {
            if (app.activeView != self) {
                return false;
            }
            self.renderCommon(true);
            var data = countlyViews.getActionsData();
            if(self.map){
                self.map.clear();
                self.map.data(self.getData(data.data));
                self.baseRadius = Math.max((48500-35*data.data.length)/900, 5);
                self.drawMap();
            }
        });
    }
});
//register views
app.viewsView = new ViewsView();
app.viewFrequencyView = new ViewFrequencyView();
app.actionMapView = new ActionMapView();

app.route("/analytics/views", 'views', function () {
	this.renderWhenReady(this.viewsView);
});

app.route("/analytics/view-frequency", 'views', function () {
	this.renderWhenReady(this.viewFrequencyView);
});

app.route("/analytics/views/action-map/*view", 'views', function (view) {
    this.actionMapView.view = view;
	this.renderWhenReady(this.actionMapView);
});

app.addPageScript("/drill#", function(){
    var drillClone;
    var self = app.drillView;
    if(countlyGlobal["record_views"]){
        $("#drill-types").append('<div id="drill-type-views" class="item">'+jQuery.i18n.map["views.title"]+'</div>');
        $("#drill-type-views").on("click", function() {
            if ($(this).hasClass("active")) {
                return true;
            }
    
            $("#drill-types").find(".item").removeClass("active");
            $(this).addClass("active");
            $("#event-selector").hide();
    
            $("#drill-no-event").fadeOut();
            $("#segmentation-start").fadeOut().remove();
            $(this).parents(".cly-select").removeClass("dark");
    
            $(".event-select.cly-select").find(".text").text(jQuery.i18n.map["drill.select-event"]);
            $(".event-select.cly-select").find(".text").data("value","");
    
            currEvent = "[CLY]_view";
    
            self.graphType = "line";
            self.graphVal = "times";
            self.filterObj = {};
            self.byVal = "";
            self.drillChartDP = {};
            self.drillChartData = {};
            self.activeSegmentForTable = "";
            countlySegmentation.reset();
    
            $("#drill-navigation").find(".menu[data-open=table-view]").hide();
    
            $.when(countlySegmentation.initialize(currEvent)).then(function () {
                $("#drill").replaceWith(drillClone.clone(true));
                self.adjustFilters();
                self.draw(true, false);
            });
        });
        setTimeout(function() {
            drillClone = $("#drill").clone(true);
        }, 0);
    }
});

app.addPageScript("/custom#", function(){
    
    if(countlyGlobal["plugins"].indexOf("dashboards") < 0){
        return;
    }

    //TO REFRESH VIEWS DATA CHECK FETCH.JS IN API LINE NO: 926
    //SEGMENT THINGY REMAINING
    
    var viewsWidgetTemplate;
    var viewsMetric = [
        { name: "Total Visitors",  value: "u" },
        { name: "New Visitors",  value: "n" },
        { name: "Total Visits",  value: "t" },
        { name: "Avg. Time",  value: "d" },
        { name: "Landings",  value: "s" },
        { name: "Exits",  value: "e" },
        { name: "Bounces",  value: "b" }
    ];

    function returnViewName(view){
        var name = "Unknown";

        var viewName = viewsMetric.filter(function(obj){
            return obj.value == view;
        });

        if(viewName.length){
            name = viewName[0].name;
        }

        return name;
    }

    $.when(
        $.get(countlyGlobal["path"]+'/views/templates/widget.html', function(src){
            viewsWidgetTemplate = Handlebars.compile(src);
        })
    ).then(function () {
        addWidgetScript();
        
        var widgetOptions = {
            init: initWidgetSections,
            settings: widgetSettings,
            placeholder: addPlaceholder,
            create: createWidgetView,
            reset: resetWidget,
            set: setWidget,
            refresh: refreshWidget
        };

        app.addWidgetCallbacks("views", widgetOptions);
    });

    function addWidgetScript(){
        addWidgetType();
        addSettingsSection();

        $("#multi-views-dropdown").on("cly-multi-select-change", function() {
            $("#widget-drawer").trigger("cly-widget-section-complete");
        });

        function addWidgetType(){
            var viewsWidget =   '<div data-widget-type="views" class="opt cly-grid-5">' +
                                '    <div class="inner">' +
                                '        <span class="icon views"></span>' +
                                '        Views' +
                                '    </div>' +
                                '</div>';
    
            $("#widget-drawer .details #widget-types .opts").append(viewsWidget);
        }
    
        function addSettingsSection(){
            var setting =   '<div id="widget-section-multi-views" class="settings section">' +
                            '    <div class="label">Views</div>' +
                            '    <div id="multi-views-dropdown" class="cly-multi-select" data-max="2" style="width: 100%; box-sizing: border-box;">' +
                            '        <div class="select-inner">' +
                            '            <div class="text-container">' +
                            '                <div class="text">' +
                            '                    <div class="default-text">Select maximum 2 metrics</div>' +
                            '                </div>' +
                            '            </div>' +
                            '            <div class="right combo"></div>' +
                            '        </div>' +
                            '        <div class="select-items square" style="width: 100%;"></div>' +
                            '    </div>' +
                            '</div>';

            $("#widget-drawer .details").append(setting);
        }
    }

    function initWidgetSections(){
        var selWidgetType = $("#widget-types").find(".opt.selected").data("widget-type");

        if(selWidgetType != "views"){
            return;
        }
        
        $("#widget-drawer .details #data-types").parent(".section").hide();
        $("#widget-section-single-app").show();
        $("#multi-views-dropdown").clyMultiSelectSetItems(viewsMetric);
        $("#widget-section-multi-views").show();
    }

    function widgetSettings(){
        var $singleAppDrop = $("#single-app-dropdown"),
            $multiViewsDrop = $("#multi-views-dropdown");
            
        var selectedApp = $singleAppDrop.clySelectGetSelection();
        var selectedViews = $multiViewsDrop.clyMultiSelectGetSelection();

        var settings = {
            apps: (selectedApp)? [ selectedApp ] : [],
            views: selectedViews
        };

        return settings;
    }

    function addPlaceholder(dimensions){
        dimensions.min_height = 4;
        dimensions.min_width = 4;
        dimensions.width = 4;
        dimensions.height = 4;
    }

    function createWidgetView(widgetData){
        var placeHolder = widgetData.placeholder;
        
        formatData(widgetData);
        render();
        
        function render() {
            var title = widgetData.title,
                app = widgetData.apps,
                data = widgetData.formattedData;
                
            var appName = countlyGlobal.apps[app[0]].name,
            appId = app[0];

            var $widget = $(viewsWidgetTemplate({
                title: title,
                app: {
                    id: appId,
                    name: appName
                },
                "views": data.viewsValueNames,                
                "views-data": data.viewsData,
            }));

            placeHolder.find("#loader").fadeOut();
            placeHolder.find(".cly-widget").html($widget.html());

            if (!title) {
                var widgetTitle = "Page Views";
                placeHolder.find(".title").text(widgetTitle);
            }

            addTooltip(placeHolder);
        }
    }

    function formatData(widgetData){
        var data = widgetData.data,
            views = widgetData.views;

        var viewsValueNames = [];

        for(var i = 0; i < views.length; i++){
            viewsValueNames.push({
                name: returnViewName(views[i]),
                value: views[i]
            });
        }

        data.chartData.splice(10);
        
        var viewsData = [];
        for(var i = 0; i < data.chartData.length; i++){
            viewsData.push({
                views: data.chartData[i].views,
                data: []
            });
            for(var j = 0; j < viewsValueNames.length; j++){
                var fullName = viewsValueNames[j].name;
                var metricName = viewsValueNames[j].value;
                var value = data.chartData[i][metricName];
                if(metricName == "d"){
                    var totalVisits = data.chartData[i]["t"];
                    var time = (value == 0 || totalVisits == 0) ? 0 : value/totalVisits;
                    value = countlyCommon.timeString(time/60);
                }
                viewsData[i].data.push({
                    value: value,
                    name: fullName
                })
            }
        }
        var returnData = {
            viewsData: viewsData,
            viewsValueNames: viewsValueNames
        }

        widgetData.formattedData = returnData;
    }

    function resetWidget(){
        $("#multi-views-dropdown").clyMultiSelectClearSelection();
    }

    function setWidget(widgetData){
        var views = widgetData.views;
        var apps = widgetData.apps;
        var $multiViewsDrop = $("#multi-views-dropdown");
        var $singleAppDrop = $("#single-app-dropdown");
        
        $singleAppDrop.clySelectSetSelection(apps[0], countlyGlobal.apps[apps[0]].name);
        
        var viewsValueNames = [];
        for (var i = 0; i < views.length; i++) {
            viewsValueNames.push({
                name: returnViewName(views[i]),
                value: views[i]
            });
        }

        $multiViewsDrop.clyMultiSelectSetSelection(viewsValueNames);
    }

    function refreshWidget(widgetEl, widgetData){
        formatData(widgetData);
        var data = widgetData.formattedData;

        var $widget = $(viewsWidgetTemplate({
            title: "",
            app: {
                id: "",
                name: ""
            },
            "views": data.viewsValueNames,                
            "views-data": data.viewsData,
        }));

        widgetEl.find("table").replaceWith($widget.find("table"));
        addTooltip(widgetEl);
    }

    function addTooltip(placeHolder){
        placeHolder.find('.views table tr td:first-child').tooltipster({
            animation: "fade",
            animationDuration: 50,
            delay: 100,
            theme: 'tooltipster-borderless',
            trigger: 'custom',
            triggerOpen: {
                mouseenter: true,
                touchstart: true
            },
            triggerClose: {
                mouseleave: true,
                touchleave: true
            },
            interactive: true,
            contentAsHTML: true,
            functionInit: function(instance, helper) {
                instance.content(getTooltipText($(helper.origin).parents(placeHolder.find("views table tr td:first-child"))));
            }
        })

        function getTooltipText(jqueryEl) {
            var viewName = jqueryEl.find("td:first-child").data("view-name");
            var tooltipStr = "<div id='views-tip'>";

            tooltipStr += viewName;
            
            tooltipStr += "</div>";
    
            return tooltipStr;
        }
    }
});

$( document ).ready(function() {
    if(!production){
        CountlyHelpers.loadJS("views/javascripts/simpleheat.js");
    }
    jQuery.fn.dataTableExt.oSort['view-frequency-asc']  = function(x, y) {
        x = countlyViews.getFrequencyIndex(x);
        y = countlyViews.getFrequencyIndex(y);

        return ((x < y) ? -1 : ((x > y) ?  1 : 0));
    };

    jQuery.fn.dataTableExt.oSort['view-frequency-desc']  = function(x, y) {
        x = countlyViews.getFrequencyIndex(x);
        y = countlyViews.getFrequencyIndex(y);

        return ((x < y) ?  1 : ((x > y) ? -1 : 0));
    };
	var menu = '<a href="#/analytics/views" class="item">'+
		'<div class="logo-icon fa fa-eye"></div>'+
		'<div class="text" data-localize="views.title"></div>'+
	'</a>';
	$('#web-type #analytics-submenu').append(menu);
	$('#mobile-type #analytics-submenu').append(menu);
    
    var menu = '<a href="#/analytics/view-frequency" class="item">'+
		'<div class="logo-icon fa fa-eye"></div>'+
		'<div class="text" data-localize="views.view-frequency"></div>'+
	'</a>';
	$('#web-type #engagement-submenu').append(menu);
	$('#mobile-type #engagement-submenu').append(menu);
    
    //check if configuration view exists
    if(app.configurationsView){
        app.configurationsView.registerLabel("views", "views.title");
        app.configurationsView.registerLabel("views.view_limit", "views.view-limit");
    }
});
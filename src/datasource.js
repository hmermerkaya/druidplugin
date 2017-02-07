///<reference path="app/headers/common.d.ts" />
///<reference path="jsep.d.ts" />
System.register(['lodash', 'app/core/utils/datemath', 'moment', 'jsep'], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var lodash_1, dateMath, moment_1, jsep_1;
    var DruidDatasource;
    return {
        setters:[
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            },
            function (dateMath_1) {
                dateMath = dateMath_1;
            },
            function (moment_1_1) {
                moment_1 = moment_1_1;
            },
            function (jsep_1_1) {
                jsep_1 = jsep_1_1;
            }],
        execute: function() {
            DruidDatasource = (function () {
                /** @ngInject */
                function DruidDatasource(instanceSettings, $q, backendSrv, templateSrv) {
                    this.$q = $q;
                    this.backendSrv = backendSrv;
                    this.templateSrv = templateSrv;
                    this.filterTemplateExpanders = {
                        "selector": lodash_1.default.partialRight(this.replaceTemplateValues, ['value']),
                        "regex": lodash_1.default.partialRight(this.replaceTemplateValues, ['pattern']),
                        "javascript": lodash_1.default.partialRight(this.replaceTemplateValues, ['function']),
                    };
                    this.type = 'druid-datasource';
                    this.url = instanceSettings.url;
                    this.name = instanceSettings.name;
                    this.basicAuth = instanceSettings.basicAuth;
                    instanceSettings.jsonData = instanceSettings.jsonData || {};
                    this.supportAnnotations = true;
                    this.supportMetrics = true;
                    this.q = $q;
                    this.backendSrv = backendSrv;
                    this.templateSrv = templateSrv;
                }
                DruidDatasource.prototype.replaceTemplateValues = function (obj, attrList) {
                    var self = this;
                    var substitutedVals = attrList.map(function (attr) {
                        return self.templateSrv.replace(obj[attr]);
                    });
                    return lodash_1.default.assign(lodash_1.default.clone(obj, true), lodash_1.default.zipObject(attrList, substitutedVals));
                };
                DruidDatasource.prototype.testDatasource = function () {
                    return this._get('/druid/v2/datasources').then(function () {
                        return { status: "success", message: "Druid Data source is working", title: "Success" };
                    });
                };
                //Get list of available datasources
                DruidDatasource.prototype.getDataSources = function () {
                    return this._get('/druid/v2/datasources').then(function (response) {
                        return response.data;
                    });
                };
                DruidDatasource.prototype.getDimensionsAndMetrics = function (datasource) {
                    return this._get('/druid/v2/datasources/' + datasource).then(function (response) {
                        return response.data;
                    });
                };
                DruidDatasource.prototype.metricFindQuery = function (query) {
                    // FIXME: datasource should be taken from the Template query options.
                    return this._get('/druid/v2/datasources/BeaconDataSource').then(function (response) {
                        var dimensions = lodash_1.default.map(response.data.dimensions, function (e) { return { "text": e }; });
                        dimensions.unshift({ "text": "--" });
                        return dimensions;
                    });
                };
                DruidDatasource.prototype._get = function (relativeUrl, params) {
                    return this.backendSrv.datasourceRequest({
                        method: 'GET',
                        url: this.url + relativeUrl,
                        params: params,
                    });
                };
                // Called once per panel (graph)
                DruidDatasource.prototype.query = function (options) {
                    var dataSource = this;
                    console.log("Do query");
                    console.log(options);
                    var refId_MetricNames = [];
                    var promises = options.targets.map(function (target) {
                        var date_from = options.range.from.clone();
                        var date_to = options.range.to.clone();
                        //console.log("target.timeShift",target.timeShift);
                        //console.log("target.prePostAgg",target.currentPrePostAgg);
                        dataSource._timeShiftFromTo(target, "back", date_from, date_to);
                        var from = DruidDatasource.dateToMoment(date_from, false);
                        var to = DruidDatasource.dateToMoment(date_to, true);
                        if (lodash_1.default.isEmpty(target.druidDS) || ((lodash_1.default.isEmpty(target.aggregators) && lodash_1.default.isEmpty(target.aggregators1)) && target.queryType !== "select")) {
                            console.log("target.druidDS: " + target.druidDS + ", target.aggregators: " + target.aggregators + target.aggregators1);
                            var d = dataSource.q.defer();
                            d.resolve([]);
                            return d.promise;
                        }
                        var aggregators = dataSource._merge(target.aggregators, target.aggregators1);
                        var postAggregators = dataSource._merge(target.postAggregators, target.postAggregators1);
                        refId_MetricNames.push(lodash_1.default.map(DruidDatasource.getMetricNames(aggregators, postAggregators), function (x) {
                            var tmp = {};
                            tmp[target.refId] = x;
                            return tmp;
                        }));
                        // console.log("target.postAggregatorsss",target.postAggregators,target.postAggregators1);
                        var maxDataPointsByResolution = options.maxDataPoints;
                        var maxDataPointsByConfig = target.maxDataPoints ? target.maxDataPoints : Number.MAX_VALUE;
                        var maxDataPoints = Math.min(maxDataPointsByResolution, maxDataPointsByConfig);
                        var granularity = null;
                        if (target.shouldOverrideGranularity)
                            granularity = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (entry) { return entry[0] === target.customGranularity; });
                        else
                            granularity = dataSource.computeGranularity(from, to, maxDataPoints);
                        //Round up to start of an interval
                        //Width of bar chars in Grafana is determined by size of the smallest interval
                        var roundedFrom = granularity[0] === "all" ? from : dataSource.roundUpStartTime(from, granularity[0]);
                        return dataSource._doQuery(roundedFrom, to, granularity[2], target);
                    });
                    return dataSource.q.all(promises).then(function (results) {
                        var tmp_res = lodash_1.default.flatten(results);
                        // console.log("tmp_res",tmp_res);
                        tmp_res.forEach(function (x) {
                            if (!lodash_1.default.isEmpty(x.refAgg)) {
                                var found = false;
                                tmp_res.forEach(function (y) {
                                    if (y.refId == Object.keys(x.refAgg)[0]) {
                                        if (y.target == x.refAgg[Object.keys(x.refAgg)[0]]) {
                                            if (x.datapoints.length != y.datapoints.length)
                                                throw "datasources don't have same granularity";
                                            var tmp_str = x.expression;
                                            var trg_agg = Object.keys(x.refAgg)[0] + "." + x.refAgg[Object.keys(x.refAgg)[0]];
                                            var new_str = tmp_str.replace(new RegExp(trg_agg, "g"), "trgAgg");
                                            //console.log("new_str",new_str);
                                            if (x.refKey)
                                                new_str = new_str.replace(new RegExp(x.refKey, "g"), "curr");
                                            tmp_res.forEach(function (k) {
                                                if (k.refId == x.refId) {
                                                    if (!x.refKey || k.target == x.refKey) {
                                                        if (x.datapoints.length == 0)
                                                            throw "no datapoint exists in this range. Change the range";
                                                        x.datapoints.forEach(function (z, idz, array) {
                                                            if (!x.refKey) {
                                                                var trgAgg = y.datapoints[idz][0];
                                                                var corr = eval(new_str);
                                                                z[0] = corr;
                                                                found = true;
                                                            }
                                                            else if (k.target == x.refKey) {
                                                                var curr = k.datapoints[idz][0];
                                                                var trgAgg = y.datapoints[idz][0];
                                                                var corr = eval(new_str);
                                                                z[0] = corr;
                                                                found = true;
                                                            }
                                                        });
                                                    }
                                                }
                                            });
                                        }
                                    }
                                });
                                if (!found)
                                    throw Object.keys(x.refAgg)[0] + "." + x.refAgg[Object.keys(x.refAgg)[0]] + " does not exist";
                            }
                        });
                        //console.log(".flatten(refId_MetricNames)",_.flatten(refId_MetricNames));
                        var tmp_res1 = lodash_1.default.filter(tmp_res, function (x) {
                            for (var i = 0; i < lodash_1.default.flatten(refId_MetricNames).length; i++) {
                                var tmp = {};
                                tmp[x.refId] = x.target;
                                if (lodash_1.default.isEqual(lodash_1.default.flatten(refId_MetricNames)[i], tmp))
                                    return true;
                            }
                            return false;
                        });
                        tmp_res1.forEach(function (x) {
                            if (x.timeShift)
                                x.target = x.target + "_" + x.timeShift + "_shift";
                            x.datapoints.forEach(function (y) {
                                var date = DruidDatasource.dateToMoment(new Date(y[1]), false);
                                dataSource._timeShiftFromTo(x, "forth", date);
                                if (x.timeShift)
                                    y[1] = date.valueOf();
                            });
                        });
                        // console.log("tmp_res",tmp_res);
                        return { data: tmp_res1 };
                    });
                };
                DruidDatasource.prototype._doQuery = function (from, to, granularity, target) {
                    var _this = this;
                    var self = this;
                    var datasource = target.druidDS;
                    var filters = target.filters;
                    //target.postAggregators=target.postAggregators||[];
                    var aggregators = this._merge(target.aggregators, target.aggregators1);
                    var postAggregators = this._merge(target.postAggregators, target.postAggregators1);
                    //  target.postAggregators=target.postAggregators||[];
                    //var postAggregators=target.postAggregators;
                    for (var i = 0; i < postAggregators.length; i++) {
                        var parse_tree;
                        parse_tree = jsep_1.default(postAggregators[i].expression);
                        //console.log("parse_tree",parse_tree);
                        var keys = [], refid = {};
                        this._parseObjectKeys(parse_tree, "name", keys, refid);
                        //console.log("keys",keys);
                        postAggregators[i]["refId"] = refid;
                        postAggregators[i]["refKey"] = keys;
                    }
                    ;
                    var groupBy = target.groupBy;
                    console.log("original groupBy: " + JSON.stringify(groupBy));
                    var interpolatedGroupBy = lodash_1.default.map(groupBy, function (e) {
                        return _this.templateSrv.replace(String(e).replace(/^\s+|\s+$/g, ''), null, 'regex');
                    }).filter(function (e) { return e != "--"; });
                    console.log("interpolated groupBy: " + JSON.stringify(interpolatedGroupBy));
                    groupBy = interpolatedGroupBy;
                    var limitSpec = null;
                    var metricNames = DruidDatasource.getMetricNames(aggregators, postAggregators);
                    var allMetricNames = DruidDatasource.getAllMetricNames(aggregators, postAggregators);
                    var intervals = DruidDatasource.getQueryIntervals(from, to);
                    var promise = null;
                    var selectMetrics = target.selectMetrics;
                    var selectDimensions = target.selectDimensions;
                    var selectThreshold = target.selectThreshold;
                    if (!selectThreshold) {
                        selectThreshold = 5;
                    }
                    if (target.queryType === 'SQL') {
                        console.log(target);
                    }
                    else if (target.queryType === 'topN') {
                        var threshold = target.limit;
                        var metric = target.druidMetric;
                        var dimension = target.dimension;
                        promise = this._topNQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension)
                            .then(function (response) {
                            return self.convertTopNData(response.data, dimension, metric);
                        });
                    }
                    else if (target.queryType === 'groupBy') {
                        limitSpec = DruidDatasource.getLimitSpec(target.limit, target.orderBy);
                        promise = this._groupByQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec)
                            .then(function (response) {
                            return self.convertGroupByData(response.data, groupBy, metricNames);
                        });
                    }
                    else if (target.queryType === 'select') {
                        promise = this._selectQuery(datasource, intervals, granularity, selectDimensions, selectMetrics, filters, selectThreshold);
                        return promise.then(function (response) {
                            return self.convertSelectData(response.data);
                        });
                    }
                    else {
                        promise = this._timeSeriesQuery(datasource, intervals, granularity, filters, aggregators, postAggregators)
                            .then(function (response) {
                            return DruidDatasource.convertTimeSeriesData(response.data, allMetricNames, target);
                        });
                    }
                    /*
                     At this point the promise will return an list of time series of this form
                     [
                     {
                     target: <metric name>,
                     datapoints: [
                     [<metric value>, <timestamp in ms>],
                     ...
                     ]
                     },
                     ...
                     ]
                
                     Druid calculates metrics based on the intervals specified in the query but returns a timestamp rounded down.
                     We need to adjust the first timestamp in each time series
                     */
                    return promise.then(function (metrics) {
                        var fromMs = DruidDatasource.formatTimestamp(from);
                        metrics.forEach(function (metric) {
                            if (!lodash_1.default.isEmpty(metric.datapoints[0]) && metric.datapoints[0][1] < fromMs) {
                                metric.datapoints[0][1] = fromMs;
                            }
                        });
                        return metrics;
                    });
                };
                DruidDatasource.prototype._selectQuery = function (datasource, intervals, granularity, dimension, metric, filters, selectThreshold) {
                    var query = {
                        "queryType": "select",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "pagingSpec": { "pagingIdentifiers": {}, "threshold": selectThreshold },
                        "dimensions": dimension,
                        "metrics": metric,
                        "intervals": intervals
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f)
                            query["filter"] = f;
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._timeSeriesQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators) {
                    var query = {
                        "queryType": "timeseries",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) { return e.druidQuery; }),
                        "intervals": intervals
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f)
                            query["filter"] = f;
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._topNQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension) {
                    var query = {
                        "queryType": "topN",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "threshold": threshold,
                        "dimension": dimension,
                        "metric": metric,
                        // "metric": {type: "inverted", metric: metric},
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) { return e.druidQuery; }),
                        "intervals": intervals
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f)
                            query["filter"] = f;
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._groupByQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec) {
                    var query = {
                        "queryType": "groupBy",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "dimensions": groupBy,
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) { return e.druidQuery; }),
                        "intervals": intervals,
                        "limitSpec": limitSpec
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f)
                            query["filter"] = f;
                    }
                    return this._druidQuery(query);
                };
                ;
                DruidDatasource.prototype._sqlQuery = function (datasource, columns, where, group_by, having, order_by, limit, offset) {
                    var query = {
                        "queryType": "sql"
                    };
                    var sql = "SELECT " + DruidDatasource.buildColumns(columns) + " FROM " + datasource;
                    if (where) {
                        sql = sql + " WHERE " + where;
                    }
                    if (group_by) {
                        sql = sql + " GROUP BY " + group_by;
                    }
                    if (having) {
                        sql = sql + " HAVING " + having;
                    }
                    if (order_by) {
                        sql = sql + " ORDER BY " + order_by;
                    }
                    if (limit) {
                        sql = sql + " LIMIT " + limit;
                        if (offset) {
                            sql = sql + " OFFSET " + offset;
                        }
                    }
                    query['sql'] = sql;
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._merge = function (componet1, componet2) {
                    componet1 = componet1 || [];
                    componet2 = componet2 || [];
                    // if (typeof componet1 =="undefined") componet1=[];
                    // if (typeof componet2 =="undefined") componet2=[];
                    /* componet1= (typeof  componet1!= "undefined" ) ?  componet1:[];
                     componet2= (typeof  componet2!= "undefined" ) ?  componet2 :[];
                       */
                    return componet1.concat(componet2);
                };
                DruidDatasource.prototype._parseObjectKeys = function (obj, name, keys, refid) {
                    for (var prop in obj) {
                        if (prop == "object")
                            refid[obj.object.name] = obj.property.name;
                        else if (prop == "property")
                            continue;
                        else {
                            var sub = obj[prop];
                            // console.log("prop[name]",prop);
                            if (prop == name) {
                                keys.push(obj[name]);
                            }
                        }
                        if (typeof (sub) == "object") {
                            this._parseObjectKeys(sub, name, keys, refid);
                        }
                    }
                };
                DruidDatasource.prototype._parseTimeShift = function (target) {
                    if (target.timeShift) {
                        //var myRegexp = /^(\+\d+|-\d+|\d+)(d|h){1}$/g;
                        var myRegexp = /^(\d+|\+\d+)(d|h){1}$/g;
                        var match = myRegexp.exec(target.timeShift);
                        if (match)
                            return match;
                        else
                            return null;
                    }
                    else
                        return null;
                };
                DruidDatasource.prototype._timeShiftFromTo = function (target, backOrforth, from, to) {
                    if (target.timeShift) {
                        var match = this._parseTimeShift(target);
                        var direction = null;
                        if (backOrforth == "back")
                            direction = -1;
                        else if (backOrforth == "forth")
                            direction = 1;
                        else
                            return;
                        if (!match) {
                            target.timeShift = undefined;
                            return;
                        }
                        if (match[2] == "d") {
                            from.add((direction) * Number(match[1]), "days");
                            if (typeof to !== 'undefined')
                                to.add((direction) * Number(match[1]), "days");
                        }
                        else if (match[2] == "h") {
                            from.add((direction) * Number(match[1]), "hours");
                            if (typeof to !== 'undefined')
                                to.add((direction) * Number(match[1]), "hours");
                        }
                    }
                };
                DruidDatasource.buildColumns = function (columns) {
                    return columns.join(", ");
                };
                DruidDatasource.prototype._druidQuery = function (query) {
                    var options = {
                        method: 'POST',
                        url: this.url + '/druid/v2/?pretty',
                        data: query
                    };
                    console.log("Make http request");
                    console.log(JSON.stringify(options));
                    return this.backendSrv.datasourceRequest(options);
                };
                ;
                DruidDatasource.getLimitSpec = function (limitNum, orderBy) {
                    return {
                        "type": "default",
                        "limit": limitNum,
                        "columns": !orderBy ? null : orderBy.map(function (col) {
                            return { "dimension": col, "direction": "DESCENDING" };
                        })
                    };
                };
                DruidDatasource.prototype.buildFilterTree = function (filters) {
                    //Do template variable replacement
                    var self = this;
                    var replacedFilters = filters.map(function (filter) {
                        // TODO: fix the function map lookup
                        // return this.filterTemplateExpanders[filter.type](filter);
                        if (filter.type == "selector")
                            return self.replaceTemplateValues(filter, ['value']);
                        else if (filter.type == "regex")
                            return self.replaceTemplateValues(filter, ['pattern']);
                        else if (filter.type == "javascript")
                            return self.replaceTemplateValues(filter, ['function']);
                    })
                        .map(function (filter) {
                        var finalFilter = lodash_1.default.omit(filter, 'negate');
                        if (filter && "negate" in filter && filter.negate) {
                            return { "type": "not", "field": finalFilter };
                        }
                        return finalFilter;
                    });
                    if (replacedFilters) {
                        if (replacedFilters.length === 1) {
                            return replacedFilters[0];
                        }
                        return {
                            "type": "and",
                            "fields": replacedFilters
                        };
                    }
                    return null;
                };
                DruidDatasource.getQueryIntervals = function (from, to) {
                    return [from.toISOString() + '/' + to.toISOString()];
                };
                DruidDatasource.getMetricNames = function (aggregators, postAggregators) {
                    var displayAggs = lodash_1.default.filter(aggregators, function (agg) {
                        return agg.display && agg.type !== 'approxHistogramFold';
                    });
                    return lodash_1.default.union(lodash_1.default.map(displayAggs, 'name'), lodash_1.default.map(postAggregators, 'name'));
                };
                DruidDatasource.getAllMetricNames = function (aggregators, postAggregators) {
                    var displayAggs = lodash_1.default.filter(aggregators, function (agg) {
                        return agg.type !== 'approxHistogramFold';
                    });
                    return lodash_1.default.union(lodash_1.default.map(displayAggs, 'name'), lodash_1.default.map(postAggregators, 'name'));
                };
                ;
                DruidDatasource.formatTimestamp = function (ts) {
                    return moment_1.default(ts).format('X') * 1000;
                };
                DruidDatasource.convertTimeSeriesData = function (md, metrics, trg) {
                    return metrics.map(function (metric) {
                        var postagg = {};
                        var ref_agg, exp, refkey;
                        trg.postAggregators = trg.postAggregators || [];
                        trg.postAggregators1 = trg.postAggregators1 || [];
                        //console.log("trg.postAggregators,trg.postAggregators1",trg.postAggregators,trg.postAggregators);
                        var combined_postaggs = trg.postAggregators.concat(trg.postAggregators1);
                        // console.log("combined_postaggs",combined_postaggs);
                        if (postagg = lodash_1.default.find(combined_postaggs, function (x) {
                            return x.name == metric;
                        })) {
                            ref_agg = postagg.refId;
                            exp = postagg.expression;
                            if (postagg.refKey)
                                if (postagg.refKey.length == 1)
                                    refkey = postagg.refKey[0];
                        }
                        //console.log("refId",trg.refId,trg.timeShift,ref_agg,refkey,exp);
                        return {
                            target: metric,
                            timeShift: trg.timeShift,
                            refId: trg.refId,
                            refAgg: ref_agg,
                            refKey: refkey,
                            expression: exp,
                            datapoints: md.map(function (item) {
                                return [item.result[metric], DruidDatasource.formatTimestamp(item.timestamp)];
                            })
                        };
                    });
                };
                ;
                DruidDatasource.getGroupName = function (groupBy, metric) {
                    return groupBy.map(function (dim) {
                        return metric.event[dim];
                    })
                        .join("-");
                };
                DruidDatasource.prototype.convertTopNData = function (md, dimension, metric) {
                    /*
                     Druid topN results look like this:
                     [
                     {
                     "timestamp": "ts1",
                     "result": [
                     {"<dim>": d1, "<metric>": mv1},
                     {"<dim>": d2, "<metric>": mv2}
                     ]
                     },
                     {
                     "timestamp": "ts2",
                     "result": [
                     {"<dim>": d1, "<metric>": mv3},
                     {"<dim>": d2, "<metric>": mv4}
                     ]
                     },
                     ...
                     ]
                     */
                    /*
                     First, we need make sure that the result for each
                     timestamp contains entries for all distinct dimension values
                     in the entire list of results.
                
                     Otherwise, if we do a stacked bar chart, Grafana doesn't sum
                     the metrics correctly.
                     */
                    //Get the list of all distinct dimension values for the entire result set
                    var dVals = md.reduce(function (dValsSoFar, tsItem) {
                        var dValsForTs = lodash_1.default.map(tsItem.result, dimension);
                        return lodash_1.default.union(dValsSoFar, dValsForTs);
                    }, {});
                    //Add null for the metric for any missing dimension values per timestamp result
                    md.forEach(function (tsItem) {
                        var dValsPresent = lodash_1.default.map(tsItem.result, dimension);
                        var dValsMissing = lodash_1.default.difference(dVals, dValsPresent);
                        dValsMissing.forEach(function (dVal) {
                            var nullPoint = {};
                            nullPoint[dimension] = dVal;
                            nullPoint[metric] = null;
                            tsItem.result.push(nullPoint);
                        });
                        return tsItem;
                    });
                    //Re-index the results by dimension value instead of time interval
                    var mergedData = md.map(function (item) {
                        /*
                         This first map() transforms this into a list of objects
                         where the keys are dimension values
                         and the values are [metricValue, unixTime] so that we get this:
                         [
                         {
                         "d1": [mv1, ts1],
                         "d2": [mv2, ts1]
                         },
                         {
                         "d1": [mv3, ts2],
                         "d2": [mv4, ts2]
                         },
                         ...
                         ]
                         */
                        var timestamp = DruidDatasource.formatTimestamp(item.timestamp);
                        var keys = lodash_1.default.map(item.result, dimension);
                        var vals = lodash_1.default.map(item.result, metric).map(function (val) {
                            return [val, timestamp];
                        });
                        return lodash_1.default.zipObject(keys, vals);
                    })
                        .reduce(function (prev, curr) {
                        /*
                         Reduce() collapses all of the mapped objects into a single
                         object.  The keys are dimension values
                         and the values are arrays of all the values for the same key.
                         The _.assign() function merges objects together and it's callback
                         gets invoked for every key,value pair in the source (2nd argument).
                         Since our initial value for reduce() is an empty object,
                         the _.assign() callback will get called for every new val
                         that we add to the final object.
                         */
                        return lodash_1.default.assign(prev, curr, function (pVal, cVal) {
                            if (pVal) {
                                pVal.push(cVal);
                                return pVal;
                            }
                            return [cVal];
                        });
                    }, {});
                    //Convert object keyed by dimension values into an array
                    //of objects {target: <dimVal>, datapoints: <metric time series>}
                    return lodash_1.default.map(mergedData, function (vals, key) {
                        return {
                            target: key,
                            datapoints: vals
                        };
                    });
                };
                DruidDatasource.prototype.convertGroupByData = function (md, groupBy, metrics) {
                    var mergedData = md.map(function (item) {
                        /*
                         The first map() transforms the list Druid events into a list of objects
                         with keys of the form "<groupName>:<metric>" and values
                         of the form [metricValue, unixTime]
                         */
                        var groupName = DruidDatasource.getGroupName(groupBy, item);
                        var keys = metrics.map(function (metric) {
                            return groupName + ":" + metric;
                        });
                        var vals = metrics.map(function (metric) {
                            return [
                                item.event[metric],
                                DruidDatasource.formatTimestamp(item.timestamp)
                            ];
                        });
                        return lodash_1.default.zipObject(keys, vals);
                    })
                        .reduce(function (prev, curr) {
                        /*
                         Reduce() collapses all of the mapped objects into a single
                         object.  The keys are still of the form "<groupName>:<metric>"
                         and the values are arrays of all the values for the same key.
                         The _.assign() function merges objects together and it's callback
                         gets invoked for every key,value pair in the source (2nd argument).
                         Since our initial value for reduce() is an empty object,
                         the _.assign() callback will get called for every new val
                         that we add to the final object.
                         */
                        return lodash_1.default.assign(prev, curr, function (pVal, cVal) {
                            if (pVal) {
                                pVal.push(cVal);
                                return pVal;
                            }
                            return [cVal];
                        });
                    }, {});
                    return lodash_1.default.map(mergedData, function (vals, key) {
                        /*
                         Second map converts the aggregated object into an array
                         */
                        return {
                            target: key,
                            datapoints: vals
                        };
                    });
                };
                DruidDatasource.prototype.convertSelectData = function (data) {
                    var resultList = lodash_1.default.map(data, "result");
                    var eventsList = lodash_1.default.map(resultList, "events");
                    var eventList = lodash_1.default.flatten(eventsList);
                    var result = {};
                    for (var i = 0; i < eventList.length; i++) {
                        var event = eventList[i].event;
                        var timestamp = event.timestamp;
                        if (lodash_1.default.isEmpty(timestamp)) {
                            continue;
                        }
                        for (var key in Object.keys(event)) {
                            if (key !== "timestamp") {
                                if (!result[key]) {
                                    result[key] = { "target": key, "datapoints": [] };
                                }
                                result[key].datapoints.push([event[key], timestamp]);
                            }
                        }
                    }
                    return lodash_1.default.values(result);
                };
                DruidDatasource.dateToMoment = function (date, roundUp) {
                    if (date === 'now') {
                        return moment_1.default();
                    }
                    date = dateMath.parse(date, roundUp);
                    return moment_1.default(date.valueOf());
                };
                DruidDatasource.prototype.computeGranularity = function (from, to, maxDataPoints) {
                    var intervalSecs = to.unix() - from.unix();
                    /*
                     Find the smallest granularity for which there
                     will be fewer than maxDataPoints
                     */
                    var granularityEntry = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (gEntry) {
                        if (gEntry[0] == "all")
                            return true;
                        return Math.ceil(intervalSecs / gEntry[1].asSeconds()) <= maxDataPoints;
                    });
                    if (granularityEntry[0] != "all")
                        console.log("Calculated \"" + granularityEntry[0] + "\" granularity [" + Math.ceil(intervalSecs / granularityEntry[1].asSeconds()) +
                            " pts]" + " for " + (intervalSecs / 60).toFixed(0) + " minutes and max of " + maxDataPoints + " data points");
                    return granularityEntry;
                };
                DruidDatasource.prototype.roundUpStartTime = function (from, granularity) {
                    var duration = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (gEntry) {
                        return gEntry[0] === granularity;
                    })[1];
                    var rounded = moment_1.default(Math.ceil((+from) / (+duration)) * (+duration));
                    console.log("Rounding up start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
                    return rounded;
                };
                DruidDatasource.GRANULARITIES = [
                    ['minute', moment_1.default.duration(1, 'minute'), { "type": "period", "period": "PT1M", "timeZone": "Etc/UTC" }],
                    ['five_minute', moment_1.default.duration(5, 'minute'), { "type": "period", "period": "PT5M", "timeZone": "Etc/UTC" }],
                    ['fifteen_minute', moment_1.default.duration(15, 'minute'), { "type": "period", "period": "PT15M", "timeZone": "Etc/UTC" }],
                    ['thirty_minute', moment_1.default.duration(30, 'minute'), { "type": "period", "period": "PT30M", "timeZone": "Etc/UTC" }],
                    ['hour', moment_1.default.duration(1, 'hour'), { "type": "period", "period": "PT60M", "timeZone": "Etc/UTC" }],
                    ['day', moment_1.default.duration(1, 'day'), { "type": "period", "period": "PT1440M", "timeZone": "Etc/UTC" }],
                    ['all', null, 'all']
                ];
                return DruidDatasource;
            }());
            exports_1("DruidDatasource", DruidDatasource);
        }
    }
});

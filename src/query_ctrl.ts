///<reference path="app/headers/common.d.ts" />
///<reference path="jsep.d.ts" />


import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';
import jsep from 'jsep';
import $ from 'jquery';



export class DruidQueryCtrl extends QueryCtrl {
    static templateUrl = 'partials/query.editor.html';
    errors:any;
    addFilterMode:boolean;
    addFilterMode1:boolean;
    filteron:boolean;
    addAggregatorMode:boolean;
    addAggregatorMode1:boolean;
    addPostAggregatorMode:boolean;
    addPostAggregatorMode1:boolean;
    addDimensionsMode:boolean;
    addMetricsMode:boolean;
    listDataSources:any;
    getDimensionsAndMetrics:any;
    getMetrics:any;
    getDimensions:any;
    queryTypes:any;
    filterTypes:any;
    aggregatorTypes:any;
    postAggregatorTypes:any;
    arithmeticPostAggregator:any;
    customGranularity:any;
    jsonFileParsed:any;
    

    queryTypeValidators = {
        "SQL": this.validateSql.bind(this),
        "timeseries": _.noop.bind(this),
        "groupBy": this.validateGroupByQuery.bind(this),
        "topN": this.validateTopNQuery.bind(this),
        "topNJoin":this.validateTopNJoinQuery.bind(this),
        "select": this.validateSelectQuery.bind(this)
    };
    filterValidators = {
        "selector": this.validateSelectorFilter.bind(this),
        "regex": this.validateRegexFilter.bind(this),
        "javascript": this.validateJavascriptFilter.bind(this),
        "in": this.validateInFilter.bind(this),
    };

    filterValidators1 = {
        "selector": this.validateSelectorFilter1.bind(this),
        "regex": this.validateRegexFilter1.bind(this),
        "javascript": this.validateJavascriptFilter1.bind(this),
        "in": this.validateInFilter1.bind(this),
    };

    aggregatorValidators = {
        "count": this.validateCountAggregator,
        "longSum": _.partial(this.validateSimpleAggregator, 'longSum').bind(this),
        "doubleSum": _.partial(this.validateSimpleAggregator, 'doubleSum').bind(this),
        "approxHistogramFold": this.validateApproxHistogramFoldAggregator.bind(this),
        "hyperUnique": _.partial(this.validateSimpleAggregator, 'hyperUnique').bind(this)
    };
   /* aggregatorValidators1 = {
        "count": this.validateCountAggregator1,
        "longSum": _.partial(this.validateSimpleAggregator1, 'longSum').bind(this),
        "doubleSum": _.partial(this.validateSimpleAggregator1, 'doubleSum').bind(this),
        "approxHistogramFold": this.validateApproxHistogramFoldAggregator1.bind(this),
        "hyperUnique": _.partial(this.validateSimpleAggregator1, 'hyperUnique').bind(this)
    };*/

    postAggregatorValidators = {
        "arithmetic": this.validateArithmeticPostAggregator.bind(this),
        "quantile": this.validateQuantilePostAggregator.bind(this)
    };

   /*  postAggregatorValidators1 = {
        "arithmetic": this.validateArithmeticPostAggregator.bind(this),
        "quantile": this.validateQuantilePostAggregator.bind(this)
    };*/

    arithmeticPostAggregatorFns = {'+': null, '-': null, '*': null, '/': null};
    defaultQueryType = "timeseries";
    defaultFilterType = "selector";
    defaultAggregatorType = "count";
    defaultPostAggregator = {type: 'arithmetic', 'fn': '+', 'druiqQuery': null};
    customGranularities = ['minute', 'five_minute', 'fifteen_minute', 'thirty_minute', 'hour', 'day','week','month','quarter','year','all'];
    defaultCustomGranularity = 'day';
    defaultSelectDimension = "";
    defaultSelectMetric = "";
    defaultLimit = 5;
    jsonFile= '/public/plugins/hmermerkaya-druid-datasource/'+this.panelCtrl.datasource.name+".json";
  
    /** @ngInject **/
    constructor($scope, $injector, $q) {
        super($scope, $injector);
        if (!this.target.queryType) {
            this.target.queryType = this.defaultQueryType;
        }

        this.jsonFileParsed=this.readTextFile_ajax(this.jsonFile);

        this.queryTypes = _.keys(this.queryTypeValidators);
        this.filterTypes = _.keys(this.filterValidators);
        this.aggregatorTypes = _.keys(this.aggregatorValidators);
        this.postAggregatorTypes = _.keys(this.postAggregatorValidators);
        this.arithmeticPostAggregator = _.keys(this.arithmeticPostAggregatorFns);
        this.customGranularity = this.customGranularities;

        this.errors = this.validateTarget();
        if (!this.target.currentFilter) {
            this.clearCurrentFilter();
        }

        if (!this.target.currentSelect) {
            this.target.currentSelect = {};
            this.clearCurrentSelectDimension();
            this.clearCurrentSelectMetric();

        }

        if (!this.target.currentAggregator) {
            this.clearCurrentAggregator();
        }

       /* if (!this.target.currentAggregator1) {
            this.clearCurrentAggregator1();
        }*/


        if (!this.target.currentPostAggregator) {
            this.clearCurrentPostAggregator();
        }

       /* if (!this.target.currentPostAggregator1) {
            this.clearCurrentPostAggregator1();
        }*/

        if (!this.target.customGranularity) {
            this.target.customGranularity = this.defaultCustomGranularity;
        }

         if (!this.target.customGranularity1) {
            this.target.customGranularity1 = this.defaultCustomGranularity;
        }

        if (!this.target.limit) {
            this.target.limit = this.defaultLimit;
        }
        if (!this.target.shouldOverrideGranularity) {
            this.target.shouldOverrideGranularity=true;

        }

        // needs to be defined here as it is called from typeahead
        this.listDataSources = (query, callback) => {
            this.datasource.getDataSources()
                .then(callback);
        };

        this.getDimensions = (query, callback) => {
            return this.datasource.getDimensionsAndMetrics(this.target.druidDS)
                .then(function (dimsAndMetrics) {
                    callback(dimsAndMetrics.dimensions);
                });
        };

        this.getMetrics = (query, callback) => {
            return this.datasource.getDimensionsAndMetrics(this.target.druidDS)
                .then(function (dimsAndMetrics) {
                    callback(dimsAndMetrics.metrics);
                });
        };

        this.getDimensionsAndMetrics = (query, callback) => {
            console.log("getDimensionsAndMetrics.query: " + query);
            this.datasource.getDimensionsAndMetrics(this.target.druidDS)
                .then(callback);
        };

        //this.$on('typeahead-updated', function() {
        //  $timeout(this.targetBlur);
        //});
          console.log("this.panelCtrl",this.panelCtrl);
    }

    readTextFile_ajax (file) {
                  var json = null;
                        $.ajax({
                            'async': false,
                            'cache': false,
                            'global': false,
                            'url': file,
                            'dataType': "json",
                            'success': function (data) {
                                json = data;
                            }
                        });
                        console.log("json file",json);
                        return json;
                    
    }

    parseObjectKeys (obj,name,keys,refid) {
        for (var prop in obj) {
          if (prop=="object") refid.push(obj.object.name);
          else {var sub = obj[prop];
         // console.log("prop[name]",prop);
          if (prop==name) {
            keys.push(obj[name]);
          } 
          }
          if ( typeof(sub) == "object") {
            this.parseObjectKeys(sub,name,keys,refid);
          }
        }
    }

               
    findObjectKey(obj, prop) {
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                if (p === prop) {
                    return obj;
                } else if (obj[p] instanceof Object && this.findObjectKey(obj[p], prop)) {
                    return obj[p];
                }
            }
        }
        return null;
    }


    cachedAndCoalesced(ioFn, $scope, cacheName) {
        var promiseName = cacheName + "Promise";
        if (!$scope[cacheName]) {
            console.log(cacheName + ": no cached value to use");
            if (!$scope[promiseName]) {
                console.log(cacheName + ": making async call");
                $scope[promiseName] = ioFn()
                    .then(function (result) {
                        $scope[promiseName] = null;
                        $scope[cacheName] = result;
                        return $scope[cacheName];
                    });
            } else {
                console.log(cacheName + ": async call already in progress...returning same promise");
            }
            return $scope[promiseName];
        } else {
            console.log(cacheName + ": using cached value");
            var deferred;// = $q.defer();
            deferred.resolve($scope[cacheName]);
            return deferred.promise;
        }
    }

    targetBlur() {
        var self=this;
       if (self.target.druidDS) {
         var jsonFileParsed=self.readTextFile_ajax(self.jsonFile);
       delete self.target.lookups;
        if (jsonFileParsed) self.target.lookups= jsonFileParsed[self.target.druidDS].lookups;
       }
        this.errors = this.validateTarget();
        this.refresh();
    }


    addValueToValuesInFilter(){

        var self=this;


        this.target.currentFilter.valuesArr=this.target.currentFilter.valuesArr||[];
             
       // console.log("this.target.currentFilter.valuesArr",this.target.currentFilter.valuesArr);
       
        if ( !_.find(this.target.currentFilter.valuesArr,function(x){
            
            return x==self.target.currentFilter.value;



        }) && this.target.currentFilter.value!="" && this.target.currentFilter.value!=null) {
            this.target.currentFilter.valuesArr.push(this.target.currentFilter.value);  

            this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);
            delete this.target.currentFilter.value;
        }

    }
    updateValuesInFilter(){
        // this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);

        // console.log("this.target.currentFilter.values",this.target.currentFilter.values);
        if (this.target.currentFilter.values=="" || typeof this.target.currentFilter.values=="undefined") this.target.currentFilter.valuesArr=[];
        else {
             try {
                   this.target.currentFilter.valuesArr=JSON.parse(this.target.currentFilter.values);

                } catch(e) {
                   // this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);
                    alert(e); 
                }
               
        }


    }

    clearAllValuesInFilter(){

      
        delete this.target.currentFilter.valuesArr;
        delete this.target.currentFilter.values;
    }


    clearValueInFilter(){
          
        var self=this;
       _.remove(this.target.currentFilter.valuesArr, function(x) {

            return x==self.target.currentFilter.value;


         });
       //console.log("this.target.currentFilter.valuesArr",this.target.currentFilter.valuesArr);
      delete this.target.currentFilter.value;
      if (this.target.currentFilter.valuesArr.length==0) delete this.target.currentFilter.values;
      else this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);

    }





    addValueToValuesInFilter1(){

        var self=this;


        this.target.currentFilter1.valuesArr=this.target.currentFilter1.valuesArr||[];
             
       // console.log("this.target.currentFilter.valuesArr",this.target.currentFilter.valuesArr);
       
        if ( !_.find(this.target.currentFilter1.valuesArr,function(x){
            
            return x==self.target.currentFilter1.value;



        }) && this.target.currentFilter1.value!="" && this.target.currentFilter1.value!=null) {
            this.target.currentFilter1.valuesArr.push(this.target.currentFilter1.value);  

            this.target.currentFilter1.values=JSON.stringify(this.target.currentFilter1.valuesArr);
            delete this.target.currentFilter1.value;
        }

    }
    updateValuesInFilter1(){
        // this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);

        // console.log("this.target.currentFilter.values",this.target.currentFilter.values);
        if (this.target.currentFilter1.values=="" || typeof this.target.currentFilter1.values=="undefined") this.target.currentFilter.valuesArr=[];
        else {
             try {
                   this.target.currentFilter1.valuesArr=JSON.parse(this.target.currentFilter1.values);

                } catch(e) {
                   // this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);
                    alert(e); 
                }
               
        }


    }

    clearAllValuesInFilter1(){

      
        delete this.target.currentFilter1.valuesArr;
        delete this.target.currentFilter1.values;
    }


    clearValueInFilter1(){
          
        var self=this;
       _.remove(this.target.currentFilter1.valuesArr, function(x) {

            return x==self.target.currentFilter1.value;


         });
       //console.log("this.target.currentFilter.valuesArr",this.target.currentFilter.valuesArr);
      delete this.target.currentFilter1.value;
      if (this.target.currentFilter1.valuesArr.length==0) delete this.target.currentFilter1.values;
      else this.target.currentFilter1.values=JSON.stringify(this.target.currentFilter1.valuesArr);

    }



    // ------  filter  -----------
    addFilter() {
        if (!this.addFilterMode) {
            //Enabling this mode will display the filter inputs
            this.addFilterMode = true;
            return;
        }

        if (!this.target.filters) {
            this.target.filters = [];
        }

        this.target.errors = this.validateTarget();
       
        if (!this.target.errors.currentFilter) {
           if (this.target.currentFilter.type=="in") delete this.target.currentFilter.value;
            //Add new filter to the list
            // this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);
           // delete this.target.currentFilter.valuesArr;
            this.target.filters.push(this.target.currentFilter);
            this.clearCurrentFilter();
            this.addFilterMode = false;
        }

        this.targetBlur();
    }

    editFilter(index) {
        this.addFilterMode = true;
        var delFilter = this.target.filters.splice(index, 1);
        this.target.currentFilter = delFilter[0];
    }

    removeFilter(index) {
        this.target.filters.splice(index, 1);
        this.targetBlur();
    }

    clearCurrentFilter() {
        this.target.currentFilter = {type: this.defaultFilterType};
        this.addFilterMode = false;
        this.targetBlur();
    }


    addFilter1() {
        console.log("addFilterMode1",this.addFilterMode1);
        if (!this.addFilterMode1) {
            //Enabling this mode will display the filter inputs
            this.addFilterMode1 = true;
            return;
        }

        if (!this.target.filters1) {
            this.target.filters1 = [];
        }

        this.target.errors = this.validateTarget();
        //console.log("this.target.errors.currentFilter1",this.target.errors.currentFilter1);
        if ( this.target.filters.length==0) {alert("Fill the Filter Set 1 first"); throw ' ';}
        if (!this.target.errors.currentFilter1  ) {
           if (this.target.currentFilter1.type=="in") delete this.target.currentFilter1.value;
            //Add new filter to the list
            // this.target.currentFilter.values=JSON.stringify(this.target.currentFilter.valuesArr);
           // delete this.target.currentFilter.valuesArr;
            this.target.filters1.push(this.target.currentFilter1);
            this.clearCurrentFilter1();
            this.addFilterMode1 = false;
        }

        this.targetBlur();
    }

    editFilter1(index) {
        this.addFilterMode1 = true;
        var delFilter = this.target.filters1.splice(index, 1);
        this.target.currentFilter1 = delFilter[0];
    }

    removeFilter1(index) {
        this.target.filters1.splice(index, 1);
        this.targetBlur();
    }

    clearCurrentFilter1() {
        this.target.currentFilter1 = {type: this.defaultFilterType};
        this.addFilterMode1 = false;
        this.targetBlur();
    }


    // ------ dimension -------------------
    addSelectDimensions() {
        if (!this.addDimensionsMode) {
            this.addDimensionsMode = true;
            return;
        }
        if (!this.target.selectDimensions) {
            this.target.selectDimensions = [];
        }
        this.target.selectDimensions.push(this.target.currentSelect.dimension);
        this.clearCurrentSelectDimension();
    }

    editDimension(index) {
        this.addDimensionsMode = true;
        var delDimensions = this.target.selectDimensions.splice(index, 1);
        this.target.currentSelect.dimension = delDimensions[0];
    }

    removeSelectDimension(index) {
        this.target.selectDimensions.splice(index, 1);
        this.targetBlur();
    }

    clearCurrentSelectDimension() {
        this.target.currentSelect.dimension = this.defaultSelectDimension;
        this.addDimensionsMode = false;
        this.targetBlur();
    }

    // ------ metric --------------------
    addSelectMetrics(display) {
        if (!this.addMetricsMode) {
            this.addMetricsMode = true;
            return;
        }
        if (!this.target.selectMetrics) {
            this.target.selectMetrics = [];
        }
        if (display)
            this.target.selectMetrics.push(this.target.currentSelect.metric);
        this.clearCurrentSelectMetric();
    }

    editSelectMetrics(index) {
        this.addMetricsMode = true;
        var delSelectMetrics = this.target.selectMetrics.splice(index, 1);
        this.target.currentSelect.metric = delSelectMetrics[0];
    }

    removeSelectMetric(index) {
        this.target.selectMetrics.splice(index, 1);
        this.targetBlur();
    }

    clearCurrentSelectMetric() {
        this.target.currentSelect.metric = this.defaultSelectMetric;
        this.addMetricsMode = false;
        this.targetBlur();
    }

    // --------- aggregator -----------------------
    addAggregator() {
        if (!this.addAggregatorMode) {
            this.addAggregatorMode = true;
            return;
        }

        if (!this.target.aggregators) {
            this.target.aggregators = [];
        }

        if (!this.target.currentAggregator.display) {
            this.target.currentAggregator.display = false;
        }

        this.target.errors = this.validateTarget();
        if (!this.target.errors.currentAggregator) {
            //Add new aggregator to the list
            this.target.aggregators.push(this.target.currentAggregator);
            this.clearCurrentAggregator();
            this.addAggregatorMode = false;
        }

        this.targetBlur();
    }

    editAggregator(index) {
        this.addAggregatorMode = true;
        var delAggregators = this.target.aggregators.splice(index, 1);
        this.target.currentAggregator = delAggregators[0];
    }

    removeAggregator(index) {
        this.target.aggregators.splice(index, 1);
        this.targetBlur();
    }

    clearCurrentAggregator() {
        this.target.currentAggregator = {type: this.defaultAggregatorType};
        this.addAggregatorMode = false;
        this.targetBlur();
    }

/*
   addAggregator1 () {
        if (!this.addAggregatorMode1) {
            this.addAggregatorMode1 = true;
            return;
        } 
        if (!this.target.aggregators1) {
            this.target.aggregators1 = [];
        }
        if (!this.target.currentAggregator1.display) {
            this.target.currentAggregator1.display = false;
        }
        //this.target.errors = this.validateTarget1();
      //  console.log("this.target.errors",this.target.errors);
        if (!this.target.errors.currentAggregator1) {
            //Add new aggregator to the list
            this.target.aggregators1.push(this.target.currentAggregator1);
            this.clearCurrentAggregator1();
            this.addAggregatorMode1 = false;
        }
        this.targetBlur1();
    };

    editAggregator1 (index) {
        this.addAggregatorMode1 = true;
        var delAggregators1 = this.target.aggregators1.splice(index, 1);
        this.target.currentAggregator1 = delAggregators1[0];
    };
    removeAggregator1 (index) {
        this.target.aggregators1.splice(index, 1);
        this.targetBlur1();
    };
    clearCurrentAggregator1 () {
        this.target.currentAggregator1 = { type: this.defaultAggregatorType };
        this.addAggregatorMode1 = false;
        this.targetBlur1();
    };
*/


    // ---- post-aggregator ---------
    addPostAggregator() {
        if (!this.addPostAggregatorMode) {
            this.addPostAggregatorMode = true;
            return;
        }

        if (!this.target.postAggregators) {
            this.target.postAggregators = [];
        }

        // translate expression to Druid query.
        var parse_tree = jsep(this.target.currentPostAggregator.expression);
        var check_obj=false;
        if  (!_.isEmpty(this.findObjectKey(parse_tree,"object"))) check_obj=true;



        this.target.currentPostAggregator.druidQuery = this.translateToDruid(parse_tree, this.target.currentPostAggregator.name,check_obj);

        this.target.errors = this.validateTarget();
        if (!this.target.errors.currentPostAggregator) {
            //Add new post aggregator to the list
            this.target.postAggregators.push(this.target.currentPostAggregator);
            this.clearCurrentPostAggregator();
            this.addPostAggregatorMode = false;
        }

        this.targetBlur();
    }

    editPostAggregator(index) {
        this.addPostAggregatorMode = true;
        var delPostAggregators = this.target.postAggregators.splice(index, 1);
        this.target.currentPostAggregator = delPostAggregators[0];
    }

    removePostAggregator(index) {
        this.target.postAggregators.splice(index, 1);
        this.targetBlur();
    }

    clearCurrentPostAggregator() {
        this.target.currentPostAggregator = _.clone(this.defaultPostAggregator);
        this.addPostAggregatorMode = false;
        this.targetBlur();
    }


    /*addPostAggregator1 () {
                   
                 

        if (!this.addPostAggregatorMode1) {
            this.addPostAggregatorMode1 = true;
            return;
        }
        if (!this.target.postAggregators1) {
            this.target.postAggregators1 = [];
        }
        // translate expression to Druid query.
        var parse_tree = jsep(this.target.currentPostAggregator1.expression);
        this.target.currentPostAggregator1.druidQuery = this.translateToDruid(parse_tree, this.target.currentPostAggregator1.name);
       // this.target.errors = this.validateTarget1();
        if (!this.target.errors.currentPostAggregator1) {
            //Add new post aggregator to the list
            this.target.postAggregators1.push(this.target.currentPostAggregator1);
            this.clearCurrentPostAggregator1();
            this.addPostAggregatorMode1 = false;
        }
     //   console.log('this.target.currentPostAggregator1',this.target.currentPostAggregator1);
        this.targetBlur1();
    };
    editPostAggregator1 (index) {
        this.addPostAggregatorMode1 = true;
        var delPostAggregators1 = this.target.postAggregators1.splice(index, 1);
        this.target.currentPostAggregator1 = delPostAggregators1[0];
    };
    removePostAggregator1  (index) {
        this.target.postAggregators1.splice(index, 1);
        this.targetBlur1();
    };
    clearCurrentPostAggregator1  () {
        this.target.currentPostAggregator1 = _.clone(this.defaultPostAggregator);
        this.addPostAggregatorMode1 = false;
        this.targetBlur1();
    };

*/



    addPredefinedPostAggregator() {
                  
      
      //var curPrePostAgg=this.target.currentPrePostAggName;
          var curPrePostAgg=this.target.currentPrePostAggID;
         // console.log('curPrePostAgg',curPrePostAgg);
         
          var jsonFileParsed= this.readTextFile_ajax(this.jsonFile);

          var found_PrePostAgg ;
          found_PrePostAgg=_.find(jsonFileParsed[this.target.druidDS].postaggregations, function (x) {
              return x.id == curPrePostAgg;
            //  return x.name == curPrePostAgg;
          })



          if (!this.target.aggregators1) this.target.aggregators1=[];
          var tmp_aggs=this.target.aggregators1;

          found_PrePostAgg.aggregations.forEach(function(x) {
            
            var found=false;
            for (var i=0;i<tmp_aggs.length;i++) {
                 if (tmp_aggs[i].name==x.name)  {
                   found=true;
                 }


             }
     
              if (!found) tmp_aggs.push(x);

            } );

             
         // console.log("found_prepostagg",found_PrePostAgg);
          var keys_list=Object.keys(found_PrePostAgg);
          
         var postAgg:any={};
          keys_list.forEach(function(x) {
            if (x != "aggregations") {
              console.log("found_PreAgg[x]",x, found_PrePostAgg[x]);
              postAgg[x]=found_PrePostAgg[x];

            }

          })

        console.log("postAgg",postAgg);


        
        var parse_tree = jsep(postAgg.expression);

        postAgg.druidQuery = this.translateToDruid(parse_tree, postAgg.name);
               


         if (!this.target.postAggregators1) this.target.postAggregators1=[];
          var postAggs=this.target.postAggregators1;

          var found=false
          this.target.postAggregators1.forEach(function(x){

              if (x.id==found_PrePostAgg.id)  found=true;

           });
           if (!found) this.target.postAggregators1.push(postAgg);

          this.targetBlur1();
      
     }

    clearAllPredefinedPostAggregators() {

          if (this.target.postAggregators1.length >0) {
           var r = confirm("Are you sure you want to clear all PrePostAggs along with aggregations?");
            if (r == true) {
                 this.target.aggregators1=[];
                 this.target.postAggregators1=[];
                  this.targetBlur1();

            } 
          }
     }


    clearPredefinedPostAggregator () {

        var json_file=this.readTextFile_ajax(this.jsonFile);
        var postAggs=json_file[this.target.druidDS].postaggregations;

        var curPrePostAgg=this.target.currentPrePostAggID;

         
        var found_PrePostAgg = postAggs.find( function (x) {
            
            return x.id == curPrePostAgg;
        })
        var tmp_aggs=this.target.aggregators1;

      
       
       
      found_PrePostAgg.aggregations.forEach(function(y){
         
         _.remove(tmp_aggs, function(x) {

            return x.name==y.name;


         });

       });
       

        var tmp_postAggs=this.target.postAggregators1;

        _.remove(tmp_postAggs,function(x) {

          return x.id==curPrePostAgg;


        });

        

        this.targetBlur1();

    }


    targetBlur1  () {
                    
      
      //  console.log("this.target.aggregators1;",this.target.aggregators1);
      //  console.log("this.target.postAggregators1",this.target.postAggregators1);
        this.jsonFileParsed=this.readTextFile_ajax(this.jsonFile);

        if (!_.isEmpty(this.target.druidDS)) {
            if (this.jsonFileParsed.hasOwnProperty(this.target.druidDS) ) {
                this.target.prePostAggsIDs = _.map(this.jsonFileParsed[this.target.druidDS].postaggregations,function(val){
                 return val.id;  
                  //  return val.name;
                  });

            } 
        }

     
       
        if (this.target.druidDS) {
        var postAggs=this.jsonFileParsed[this.target.druidDS].postaggregations;
        
      //  console.log(" postAggsggggggggg", postAggs )
        var postAggsSub=[];

        postAggs.forEach( function(x,idx){

           var tmp_obj=new Object();
           Object.keys(x).forEach(function(y){
            if (y!="aggregations" ) {

              tmp_obj[y] =x[y];
           
            }



           })

           postAggsSub.push(tmp_obj)

        } ) ;

        var clonePostaggs=this.target.postAggregators1 || [];
       
        var trans= this.translateToDruid.bind(this);

        postAggsSub.forEach( function(x) {

            clonePostaggs.forEach(function(y,idy){
              if (x.id==y.id) {
                
                if (!_.isEqual(x,y)  ){
                 
                delete  y.druidQuery;
                 Object.keys(y).forEach(function(z){
                  if (z!="aggregations" && z!="name" ) {
                    y[z]=x[z];


                  }

                 });

                  var parse_tree = jsep(y.expression);
                  y.druidQuery = trans(parse_tree, y.name);


                }

              }

            });


        });

    
      }
       // this.errors = this.validateTarget1();
        this.refresh();
    };





    addTimeShift  () {
    
                  
      if (!this.target.timeShift) {
            this.target.timeShift = undefined;
        }


     
     this.targetBlur1();  



     this.targetBlur();
        

        

    }; 


    clearTimeShift  () {
       
      //  this.addTimeShiftMode = false;
        this.target.timeShift = undefined;
        this.targetBlur();
        this.targetBlur1();
    };

    isValidFilterType(type) {
        return _.has(this.filterValidators, type);
    }

    isValidFilterType1(type) {
        return _.has(this.filterValidators1, type);
    }

    isValidAggregatorType(type) {
        return _.has(this.aggregatorValidators, type);
    }

    isValidPostAggregatorType(type) {
        return _.has(this.postAggregatorValidators, type);
    }

    isValidQueryType(type) {
        return _.has(this.queryTypeValidators, type);
    }

    isValidArithmeticPostAggregatorFn(fn) {
        return _.has(this.arithmeticPostAggregator, fn);
    }

    validateMaxDataPoints(target, errs) {
        if (target.maxDataPoints) {
            var intMax = parseInt(target.maxDataPoints);
            if (isNaN(intMax) || intMax <= 0) {
                errs.maxDataPoints = "Must be a positive integer";
                return false;
            }
            target.maxDataPoints = intMax;
        }
        return true;
    }


    validateMaxDataPoints1(target, errs) {
        if (target.maxDataPoints1) {
            var intMax = parseInt(target.maxDataPoints1);
            if (isNaN(intMax) || intMax <= 0) {
                errs.maxDataPoints1 = "Must be a positive integer";
                return false;
            }
            target.maxDataPoints1 = intMax;
        }
        return true;
    }

    validateLimit(target, errs) {
        if (!target.limit) {
            errs.limit = "Must specify a limit";
            return false;
        }
        var intLimit = parseInt(target.limit);
        if (isNaN(intLimit)) {
            errs.limit = "Limit must be a integer";
            return false;
        }
        target.limit = intLimit;
        return true;
    }

    validateOrderBy(target) {
        if (target.orderBy && !Array.isArray(target.orderBy)) {
            target.orderBy = target.orderBy.split(",");
        }
        return true;
    }

    validateGroupByQuery(target, errs) {
        if (target.groupBy && !Array.isArray(target.groupBy)) {
            target.groupBy = target.groupBy.split(",");
        }
        if (!target.groupBy) {
            errs.groupBy = "Must list dimensions to group by.";
            return false;
        }
        if (!this.validateLimit(target, errs) || !this.validateOrderBy(target)) {
            return false;
        }
        return true;
    }

    validateTopNQuery(target, errs) {
        if (!target.dimension) {
            errs.dimension = "Must specify a dimension";
            return false;
        }
        if (!target.druidMetric) {
            errs.druidMetric = "Must specify a metric";
            return false;
        }
        console.log(this, this.validateLimit);
        if (!this.validateLimit(target, errs)) {
            return false;
        }


        return true;
    }


    validateTopNJoinQuery(target,errs) {

      if (!target.dimension) {
            errs.dimension = "Must specify a dimension";
            return false;
        }
        if (!target.druidMetric) {
            errs.druidMetric = "Must specify a metric";
            return false;
        }
        console.log(this, this.validateLimit);
        if (!this.validateLimit(target, errs)) {
            return false;
        }

       // this.target.topNJoinExpression
        return true;  


    }


    validateSelectQuery(target, errs) {
        if (!target.selectThreshold && target.selectThreshold <= 0) {
            errs.selectThreshold = "Must specify a positive number";
            return false;
        }
        return true;
    }

    validateSelectorFilter(target) {
        if (!target.currentFilter.dimension) {
            return "Must provide dimension name for selector filter.";
        }
        if (!target.currentFilter.value) {
            // TODO Empty string is how you match null or empty in Druid
            return "Must provide dimension value for selector filter.";
        }
        return null;
    }

    validateJavascriptFilter(target) {
        if (!target.currentFilter.dimension) {
            return "Must provide dimension name for javascript filter.";
        }
        if (!target.currentFilter["function"]) {
            return "Must provide func value for javascript filter.";
        }
        return null;
    }

   validateInFilter(target) {
        if (!target.currentFilter.dimension) {
            return "Must provide dimension name for 'in' filter.";
        }
        if (!target.currentFilter.valuesArr || (target.currentFilter.valuesArr && target.currentFilter.valuesArr.length==0)) {
            return "Must provide  values for 'in' filter.";
        }
        return null;
    }


    validateRegexFilter(target) {
        if (!target.currentFilter.dimension) {
            return "Must provide dimension name for regex filter.";
        }
        if (!target.currentFilter.pattern) {
            return "Must provide pattern for regex filter.";
        }
        return null;
    }






    validateSelectorFilter1(target) {
        if (!target.currentFilter1.dimension) {
            return "Must provide dimension name for selector filter.";
        }
        if (!target.currentFilter1.value) {
            // TODO Empty string is how you match null or empty in Druid
            return "Must provide dimension value for selector filter.";
        }
        return null;
    }

    validateJavascriptFilter1(target) {
        if (!target.currentFilter1.dimension) {
            return "Must provide dimension name for javascript filter.";
        }
        if (!target.currentFilter1["function"]) {
            return "Must provide func value for javascript filter.";
        }
        return null;
    }

   validateInFilter1(target) {
        if (!target.currentFilter1.dimension) {
            return "Must provide dimension name for 'in' filter.";
        }
        if (!target.currentFilter1.valuesArr || (target.currentFilter1.valuesArr && target.currentFilter1.valuesArr.length==0)) {
            return "Must provide  values for 'in' filter.";
        }
        return null;
    }


    validateRegexFilter1(target) {
        if (!target.currentFilter1.dimension) {
            return "Must provide dimension name for regex filter.";
        }
        if (!target.currentFilter1.pattern) {
            return "Must provide pattern for regex filter.";
        }
        return null;
    }







    validateCountAggregator(target) {
        if (!target.currentAggregator.name) {
            return "Must provide an output name for count aggregator.";
        }
        return null;
    }

    validateSimpleAggregator(type, target) {
        if (!target.currentAggregator.name) {
            return "Must provide an output name for " + type + " aggregator.";
        }
        if (!target.currentAggregator.fieldName) {
            return "Must provide a metric name for " + type + " aggregator.";
        }
        //TODO - check that fieldName is a valid metric (exists and of correct type)
        return null;
    }

    validateApproxHistogramFoldAggregator(target) {
        var err = this.validateSimpleAggregator('approxHistogramFold', target);
        if (err) {
            return err;
        }
        //TODO - check that resolution and numBuckets are ints (if given)
        //TODO - check that lowerLimit and upperLimit are flots (if given)
        return null;
    }

    validateSimplePostAggregator(type, target) {
        if (!target.currentPostAggregator.name) {
            return "Must provide an output name for " + type + " post aggregator.";
        }
        if (!target.currentPostAggregator.fieldName) {
            return "Must provide an aggregator name for " + type + " post aggregator.";
        }
        //TODO - check that fieldName is a valid aggregation (exists and of correct type)
        return null;
    }

    validateQuantilePostAggregator(target) {
        var err = this.validateSimplePostAggregator('quantile', target);
        if (err) {
            return err;
        }
        if (!target.currentPostAggregator.probability) {
            return "Must provide a probability for the quantile post aggregator.";
        }
        return null;
    }

    translateToField(operand, checkObj) {

        console.log("operand");
        console.log(JSON.stringify(operand));
        var output;
        output = {
            "type": null
        };
      
        // console.log("checkObj",checkObj);
        if (!_.isEmpty(operand.object) && !_.isEmpty(operand.property)) {
        
                output.type = "constant";
                output['value'] = 1;
              
        } else  if (operand.type == "Identifier") {
            if (_.find(this.target.aggregators, function (entry) {
                return entry.name == operand.name && entry.type == "hyperUnique";
            })) output.type = "hyperUniqueCardinality";else output.type = "fieldAccess";
           
            // if (checkObj){   
            //   output.type = "constant";
            //   output['value'] = 1;
            // } else {

              output['name'] = operand.name;
              output['fieldName'] = operand.name;

          //  }


        } else if (operand.type == "Literal" ) {
            output.type = "constant";
           
           if (checkObj) output['value'] = 1;
           else  output['value'] = operand.value;
        } else output = this.translateToDruid(operand,"name",checkObj);

        
     
        return   output;
    };

    // TODO: set target.currentPostAggregator.errors
    translateToDruid(parse_tree, name, check_obj?:boolean) {
        if (typeof check_obj == "undefined") check_obj=false;

                 
              
      return {
            "name": name,
            "type": "arithmetic",
            "fn": parse_tree.operator,
            "fields": [this.translateToField(parse_tree.left,check_obj), this.translateToField(parse_tree.right,check_obj)]
       };


    };

    validateArithmeticPostAggregator(target) {
        if (!target.currentPostAggregator.name) {
            return "Must provide an output name for arithmetic post aggregator.";
        }
        if (!target.currentPostAggregator.expression) {
            return "Must provide a expression for arithmetic post aggregator.";
        } else {
        }
    }

    validateSql(target) {
        // TODO: implement validators
        return null;
    }

    validateTarget() {
        var validatorOut, errs: any = {};
        if (!this.target.druidDS) {
            errs.druidDS = "You must supply a druidDS name.";
        }

        if (!this.target.queryType) {
            errs.queryType = "You must supply a query type.";
        } else if (!this.isValidQueryType(this.target.queryType)) {
            errs.queryType = "Unknown query type: " + this.target.queryType + ".";
        } else {
            this.queryTypeValidators[this.target.queryType](this.target, errs);
        }

        if (this.target.shouldOverrideGranularity) {
            if (this.target.customGranularity) {
                if (!_.includes(this.customGranularity, this.target.customGranularity)) {
                    errs.customGranularity = "Invalid granularity.";
                }
            } else {
                errs.customGranularity = "You must choose a granularity.";
            }
        } else {
            this.validateMaxDataPoints(this.target, errs);
        }

        if (this.target.shouldOverrideGranularity) {
            if (this.target.customGranularity1) {
                if (!_.includes(this.customGranularity, this.target.customGranularity1)) {
                    errs.customGranularity1 = "Invalid granularity.";
                }
            } else {
                errs.customGranularity1 = "You must choose a granularity.";
            }
        } else {
            this.validateMaxDataPoints1(this.target, errs);
        }


        if (this.addFilterMode) {
            if (!this.isValidFilterType(this.target.currentFilter.type)) {
                errs.currentFilter = "Invalid filter type: " + this.target.currentFilter.type + ".";
            } else {
                validatorOut = this.filterValidators[this.target.currentFilter.type](this.target);
                if (validatorOut) {
                    errs.currentFilter = validatorOut;
                }
            }
        }

        if (this.addFilterMode1) {
            if (!this.isValidFilterType1(this.target.currentFilter1.type)) {
                errs.currentFilter1 = "Invalid filter type: " + this.target.currentFilter1.type + ".";
            } else {
                validatorOut = this.filterValidators1[this.target.currentFilter1.type](this.target);
                if (validatorOut) {
                    errs.currentFilter1 = validatorOut;
                }
            }
        }



        if (this.addAggregatorMode) {
            if (!this.isValidAggregatorType(this.target.currentAggregator.type)) {
                errs.currentAggregator = "Invalid aggregator type: " + this.target.currentAggregator.type + ".";
            } else {
                validatorOut = this.aggregatorValidators[this.target.currentAggregator.type](this.target);
                if (validatorOut) {
                    errs.currentAggregator = validatorOut;
                }
            }
        }

        if (_.isEmpty(this.target.aggregators) && !_.isEqual(this.target.queryType, "select")) {
            errs.aggregators = "You must supply at least one aggregator";
        }

        if (this.addPostAggregatorMode) {
            if (!this.isValidPostAggregatorType(this.target.currentPostAggregator.type)) {
                errs.currentPostAggregator = "Invalid post aggregator type: " + this.target.currentPostAggregator.type + ".";
            } else {
                validatorOut = this.postAggregatorValidators[this.target.currentPostAggregator.type](this.target);
                if (validatorOut) {
                    errs.currentPostAggregator = validatorOut;
                }
            }
        }

        return errs;
    }

  /*  validateTarget1 () {
        var validatorOut1,
            errs1 = {};
        if (!this.target.druidDS) {
            errs1.druidDS = "You must supply a druidDS name.";
        }
        if (!this.target.queryType) {
            errs1.queryType = "You must supply a query type.";
        } else if (!this.isValidQueryType(this.target.queryType)) {
            errs1.queryType = "Unknown query type: " + this.target.queryType + ".";
        } else {
            this.queryTypeValidators[this.target.queryType](this.target, errs1);
        }
        if (this.target.shouldOverr1ideGranularity) {
            if (this.target.customGranularity) {
                if (!_.includes(this.customGranularity, this.target.customGranularity)) {
                    errs1.customGranularity = "Invalid granularity.";
                }
            } else {
                errs1.customGranularity = "You must choose a granularity.";
            }
        } else {
            this.validateMaxDataPoints(this.target, errs1);
        }
        if (this.addFilterMode) {
            if (!this.isValidFilterType(this.target.currentFilter.type)) {
                errs1.currentFilter = "Invalid filter type: " + this.target.currentFilter.type + ".";
            } else {
                validatorOut1 = this.filterValidators[this.target.currentFilter.type](this.target);
                if (validatorOut1) {
                    errs1.currentFilter = validatorOut1;
                }
            }
        }
        if (this.addAggregatorMode1) {
            if (!this.isValidAggregatorType1(this.target.currentAggregator1.type)) {
                errs1.currentAggregator1 = "Invalid aggregator type: " + this.target.currentAggregator1.type + ".";
            } else {
                validatorOut1 = this.aggregatorValidators1[this.target.currentAggregator1.type](this.target);
                if (validatorOut1) {
                    errs1.currentAggregator1 = validatorOut1;
                }
            }
        }
        if (_.isEmpty(this.target.aggregators1) && !_.isEqual(this.target.queryType, "select")) {
            errs1.aggregators1 = "You must supply at least one aggregator";
        }
        if (this.addPostAggregatorMode1) {
            if (!this.isValidPostAggregatorType1(this.target.currentPostAggregator1.type)) {
                errs1.currentPostAggregator1 = "Invalid post aggregator type: " + this.target.currentPostAggregator1.type + ".";
            } else {
                validatorOut1 = this.postAggregatorValidators1[this.target.currentPostAggregator1.type](this.target);
                if (validatorOut1) {
                    errs1.currentPostAggregator1 = validatorOut1;
                }
            }
        }
        return errs1;
    };*/




}

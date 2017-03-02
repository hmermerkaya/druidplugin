///<reference path="app/headers/common.d.ts" />
///<reference path="jsep.d.ts" />

/*
 * Copyright 2014-2015 Quantiply Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import moment from 'moment';
import jsep from 'jsep';
//import   math from 'math';
import $ from 'jquery';

export class DruidDatasource {
  type:string;
  url:any;
  username:string;
  password:string;
  name:string;
  database:any;
  basicAuth:any;
  interval:any;
  supportAnnotations:boolean;
  supportMetrics:boolean;
  q:any;
  durationRegex:any


  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv) {
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
    this.durationRegex=/^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/
  }

  replaceTemplateValues(obj:any, attrList:string[]) {
    var self = this;
   // console.log("objjjj",obj);
    var substitutedVals = attrList.map(function (attr) {
      return self.templateSrv.replace(obj[attr]);
    });
 
    if (obj.type=="in")  return _.assign(_.clone(obj, true), _.zipObject(attrList, [obj.valuesArr]));
    //  var vals=JSON.parse(substitutedVals[0]);
 
    return _.assign(_.clone(obj, true), _.zipObject(attrList, substitutedVals));
  }

  private static GRANULARITIES = [
    ['minute', moment.duration(1, 'minute'), {"type": "period", "period": "PT1M", "timeZone": "Etc/UTC"}],
    ['five_minute', moment.duration(5, 'minute'), {"type": "period", "period": "PT5M", "timeZone": "Etc/UTC"}],
    ['fifteen_minute', moment.duration(15, 'minute'), {"type": "period", "period": "PT15M", "timeZone": "Etc/UTC"}],
    ['thirty_minute', moment.duration(30, 'minute'), {"type": "period", "period": "PT30M", "timeZone": "Etc/UTC"}],
    ['hour', moment.duration(1, 'hour'), {"type": "period", "period": "PT1H", "timeZone": "Etc/UTC"}],
    ['day', moment.duration(1, 'day'), {"type": "period", "period": "P1D", "timeZone": "Etc/UTC"}],
    ['week',moment.duration(1, 'week'),{"type": "period", "period": "P1W", "timeZone": "Etc/UTC"}],
    ['month',moment.duration(1, 'month'),{"type": "period", "period": "P1M", "timeZone": "Etc/UTC"}],
    ['quarter',moment.duration(3, 'month'),{"type": "period", "period": "P3M", "timeZone": "Etc/UTC"}],
    ['year',moment.duration(1, 'year'),{"type": "period", "period": "P1Y", "timeZone": "Etc/UTC"}],
    ['all', null, 'all']  
  ];

  private filterTemplateExpanders = {
    "selector": _.partialRight(this.replaceTemplateValues, ['value']),
    "regex": _.partialRight(this.replaceTemplateValues, ['pattern']),
    "javascript": _.partialRight(this.replaceTemplateValues, ['function']),
     "in": _.partialRight(this.replaceTemplateValues, ['values'])
  };

  public testDatasource() {
    return this._get('/druid/v2/datasources').then(function () {
      return {status: "success", message: "Druid Data source is working", title: "Success"};
    });
  }


  //Get list of available datasources
  public getDataSources() {
    return this._get('/druid/v2/datasources').then(function (response) {
      return response.data;
    });
  }

 public getDimensionsAndMetrics(datasource) {
    return this._get('/druid/v2/datasources/' + datasource+'?interval=0/3000').then(function (response) {
      console.log("response.data",response.data);
      return response.data;
    });
  }

  metricFindQuery(query) {
    // FIXME: datasource should be taken from the Template query options.
    return this._get('/druid/v2/datasources/BeaconDataSource').then( (response) => {
      var dimensions = _.map(response.data.dimensions, (e) => {return {"text": e};});
      dimensions.unshift({"text": "--"});
      return dimensions;
    });
  }

  private _get(relativeUrl:string, params?:any) {
    return this.backendSrv.datasourceRequest({
      method: 'GET',
      url: this.url + relativeUrl,
      params: params,
    })
  }


private crossPostAggsCalculator(res:any)  {

      res.forEach( function(x) {
          if (x.datapoints.length==0) throw "no datapoint exists in this range. Change the range";
          if (!_.isEmpty(x.refAgg)) {
              var tmp_str=x.expression;
              var y_list:any={};
              var k_list:any={};
              var i=0;                                     
              var trgAgg=[];
              var j=0;
              var currAgg=[];
    
              x.refAgg.forEach(function(s){
                var found=false;
                res.forEach(function(y,idy){
                  if (x.datapoints.length!=y.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
              
                  if (y.refId==Object.keys(s)[0] && y.target==s[Object.keys(s)[0]] ) {
                    
                      
                      var trg_agg=Object.keys(s)[0]+"."+s[Object.keys(s)[0]];
                      trgAgg[i]="trgAgg_"+i;
                      //tmp_str=tmp_str.replace(new RegExp(trg_agg,"g"),trgAgg[i]);
                      tmp_str=tmp_str.replace(trg_agg,trgAgg[i]);
                      y_list[trgAgg[i]]=idy;
                      i++;
                      found=true;
                   
                  }
                 

                });
               if (!found) throw Object.keys(s)[0]+"."+s[Object.keys(s)[0]]+" does not exist";
              });
             
              x.refKey.forEach( function (m){
                // var found=false;  
                console.log("mmmm",m);
                currAgg[j]="currAgg_"+j;
                tmp_str=tmp_str.replace(m ,currAgg[j]);
               // console.log("tmp str and curr",tmp_str,currAgg[j]);
                k_list[currAgg[j]]=0;

                j++;
               /* res.forEach(function (k,idk) {
                  if (x.datapoints.length!=k.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";

                  if ( k.refId==x.refId && k.target==m ) {
                   
                        currAgg[j]="currAgg_"+j;

                        tmp_str=tmp_str.replace(m ,currAgg[j]);
                        k_list[currAgg[j]]=idk
                        j++;
                        found=true;

                    }
                 
                  });*/
               //  if (!found) throw "Aggregation "+m+" does not exist";
              }) ;  
           
              x.datapoints.forEach(function (z,idz){
               // console.log("z[0]",z[0]);
           
                 for (var prop1 in k_list) {
                // this.crossPostAggsCalculator[prop1]=1;
                  window[prop1]=1;//res[k_list[prop1]].datapoints[idz][0];

                 }
                 for (var prop2 in y_list) {
                 //this.crossPostAggsCalculator[prop2]=res[y_list[prop2]].datapoints[idz][0];
                  window[prop2]=res[y_list[prop2]].datapoints[idz][0];

                 }
                  
                var corr = eval(tmp_str);
                  
                z[0]=z[0]*corr;  

              });


          }
      });

  };



/*private crossPostAggsCalculator(res:any)  {

      res.forEach( function(x) {
          if (x.datapoints.length==0) throw "no datapoint exists in this range. Change the range";
          if (!_.isEmpty(x.refAgg)) {
              var tmp_str=x.expression;
              var y_list:any={};
              var k_list:any={};
              var i=0;                                     
              var trgAgg=[];
              var j=0;
              var currAgg=[];
    
              x.refAgg.forEach(function(s){
                var found=false;
                res.forEach(function(y,idy){
                  if (x.datapoints.length!=y.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
              
                  if (y.refId==Object.keys(s)[0] && y.target==s[Object.keys(s)[0]] ) {
                    
                      
                      var trg_agg=Object.keys(s)[0]+"."+s[Object.keys(s)[0]];
                      trgAgg[i]="trgAgg_"+i;
                      //tmp_str=tmp_str.replace(new RegExp(trg_agg,"g"),trgAgg[i]);
                      tmp_str=tmp_str.replace(trg_agg,trgAgg[i]);
                      y_list[trgAgg[i]]=idy;
                      i++;
                      found=true;
                   
                  }
                 

                });
               if (!found) throw Object.keys(s)[0]+"."+s[Object.keys(s)[0]]+" does not exist";
              });
             
              x.refKey.forEach( function (m){
                var found=false;  
                res.forEach(function (k,idk) {
                  if (x.datapoints.length!=k.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";

                  if ( k.refId==x.refId && k.target==m ) {
                   
                        currAgg[j]="currAgg_"+j;

                        tmp_str=tmp_str.replace(m ,currAgg[j]);
                        k_list[currAgg[j]]=idk
                        j++;
                        found=true;

                    }
                 
                  });
                 if (!found) throw "Aggregation "+m+" does not exist";
              }) ;  
           
              x.datapoints.forEach(function (z,idz){
               
                 for (var prop1 in k_list) {
                  window[prop1]=res[k_list[prop1]].datapoints[idz][0];

                 }
                 for (var prop2 in y_list) {
                  window[prop2]=res[y_list[prop2]].datapoints[idz][0];

                 }
                  
                var corr = eval(tmp_str);
                  
                z[0]=corr;  

              });


          }
      });

  };

*/
/*
private crossPostAggsCalculator(res:any)  {

      var l1=res.length;
      while (l1--) {
        if (res[l1].datapoints.length==0) throw "no datapoint exists in this range. Change the range";
        if (!_.isEmpty(res[l1].refAgg)) {
          var tmp_str=res[l1].expression;
          var y_list:any={};
          var k_list:any={};
          var i=0;                                     
          var trgAgg=[];
          var j=0;
          var currAgg=[];

          var l2=res[l1].refAgg.length;

          while(l2--){
            var found=false;
            var tmp_refId=Object.keys(res[l1].refAgg[l2])[0], tmp_targ=res[l1].refAgg[l2][Object.keys(res[l1].refAgg[l2])[0]];
             
            var l3=res.length;
            while(l3--){
              if (res[l1].datapoints.length!=res[l3].datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
              if (res[l3].refId==tmp_refId  && res[l3].target==tmp_targ ){
                var trg_agg=tmp_refId+"."+tmp_targ;
                trgAgg[i]="trgAgg_"+i;
                tmp_str=tmp_str.replace(trg_agg,trgAgg[i]);
                y_list[trgAgg[i]]=l3;
                i++;
                found=true;

              }

            }  
            if (!found) throw tmp_refId+"."+tmp_targ+" does not exist";

          }

          l2=res[l1].refKey.length;
          while (l2--){
            var found=false; 
            var l3=res.length;
            while(l3--){
              if (res[l1].datapoints.length!=res[l3].datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
              if (res[l1].refId==res[l3].refId  && res[l3].target==res[l1].refKey[l2]) {

                currAgg[j]="currAgg_"+j;
                tmp_str=tmp_str.replace(res[l1].refKey[l2] ,currAgg[j]);
                k_list[currAgg[j]]=l3;
                j++;
                found=true;

              }

            }

            if (!found) throw "Aggregation "+res[l1].refKey[l2]+" does not exist";

          }
          
          l2=res[l1].datapoints.length;
          while(l2--){
            for (var prop1 in k_list) {
              window[prop1]=res[k_list[prop1]].datapoints[l2][0];

            }
            for (var prop2 in y_list) {
              window[prop2]=res[y_list[prop2]].datapoints[l2][0];

            }
                  
            var corr = eval(tmp_str);
              
            res[l1].datapoints[l2][0]=corr;  



          }
          

        }



      }

     

  }*/

  handleTopNJoinData(res){


          var parsedExp=null,keys=[];;
          if (res[0].topNJoinData.expression) {
              parsedExp=jsep(res[0].topNJoinData.expression);
              this._parseObjectKeys(parsedExp,"name",keys);
          }
         
          
      

          var foundVals= keys.reduce(function(a,b){
               if ( !_.find(a,function(y){
              return y == b;

            }) && (b.slice(-1)==1 || b.slice(-1)==2 ) ) {    
                a.push(b);
               
               }
                return a;

          },[])
          .sort(function(a,b){
           return  a.slice(-1) > b.slice(-1);


          })

       
         
         if (foundVals.length!=2    ) throw "there arent two variables or as labeled in placeholder";
        if (  foundVals[0].slice(0,-1) != res[0].topNJoinData.metric  || foundVals[1].slice(0,-1) != res[0].topNJoinData.metric  )  throw "  Variables are not labeled as defined in placeholder ";

        // console.log("foundVals",foundVals,druidmetric,foundVals[0].slice(0,-1), foundVals[1].slice(0,-1) );
         //console.log("topNJoinExpression",topNJoinExpression);


            var period_list=_.reduce(res,function(pval,cval){
                      var tmp=Object.keys(cval.topNJoinData.period)[0];
                 //   var tmp=Object.keys(cval.datapoints[0][2])[0];
                        if (tmp &&  !_.find(pval,function(x){

                          return tmp==x;

                        }))    { pval.push(tmp)}

                          return pval;


            },[]).sort(function(a,b){
           
                return  moment.duration(a).valueOf() >  moment.duration(b).valueOf() ;

            })

          //  console.log("period_list",period_list);
          



          var filteron0SubResData=[],filteron1SubResData=[];

           if ( period_list.length == 2 && _.find(period_list,function(x){
               return x=="all";

           })) {

                 filteron0SubResData=_.filter(res,function(x){
                  return Object.keys(x.topNJoinData.period)[0]==period_list[1];
               })

                 filteron1SubResData=_.filter(res,function(x){
                  return Object.keys(x.topNJoinData.period)[0]=="all";
               })

           }




           else if (period_list.length==1) {
                filteron0SubResData=_.filter(res,function(x){
                    return x.topNJoinData.period[Object.keys(x.topNJoinData.period)[0]]==0
                 });
                filteron1SubResData=_.filter(res,function(x){
                     return x.topNJoinData.period[Object.keys(x.topNJoinData.period)[0]]==1
                 })


           } else {

                filteron0SubResData=_.filter(res,function(x){
                  return Object.keys(x.topNJoinData.period)[0]==period_list[0];
               })

                filteron1SubResData=_.filter(res,function(x){
                 return Object.keys(x.topNJoinData.period)[0]==period_list[1]; 
                })

          }
        
           
       // console.log("filteron0SubResData",filteron0SubResData);
       //  console.log("filteron1SubResData",filteron1SubResData);
        var finalResData:any=[];
        
        filteron0SubResData.forEach(function(x){
            
            filteron1SubResData.forEach(function(y){
                
                if (x.target==y.target){
                        var tmp:any={};
                         tmp.target=x.target;
                         tmp.timeShift=x.timeShift;
                         tmp.datapoints=new Array();
                         var yPeriod=null,criValue=0;
                         if (Object.keys(y.topNJoinData.period)[0]=="all")  { yPeriod = Infinity; criValue=-Infinity}
                         else  yPeriod= moment.duration(Object.keys(y.topNJoinData.period)[0]).valueOf();

                         x.datapoints.forEach(function(z){

                            y.datapoints.forEach(function(k){
                           
                      //    console.log("z1,k1",moment(z[1]).format(),moment(k[1]).format());

                        
                           
                             //  console.log("z1 ve k1 ",z[1],k[1]); 
                              if ( moment(z[1]).diff(k[1]) >= criValue &&  moment(z[1]).diff(k[1])<yPeriod) {
                              


                                var sub_tmp=null;

                                window[foundVals[0]]=z[0];
                                window[foundVals[1]]=k[0];

                                if ( window[foundVals[1]]==null ) sub_tmp=[null, z[1]];
                                else { if (window[foundVals[0]]==null) sub_tmp=[null, z[1]];
                                  else {
                                    
                                
                                    window[foundVals[0]]=z[0];
                                    window[foundVals[1]]=k[0];

                                   // console.log(" window[foundVals[0]]", window[foundVals[0]]);
                                    var calc=eval(res[0].topNJoinData.expression);
                                    //sub_tmp=[100*z[0]/k[0], z[1]]
                                    sub_tmp=[calc, z[1]]


                                  }
                                };
                               tmp.datapoints.push(sub_tmp);
                             
                            }

                          })


                    })

                  finalResData.push(tmp);

                  
          

                }

               

            })

          

        })










  return finalResData;


  }



  // Called once per panel (graph)
  query(options) {

      var dataSource = this;
   
      console.log("Do query");
      console.log(options);
      var refId_MetricNames=[];
     // var topNJoinLimit=null;
     // var topNJoinExpression=null;
     //  var druidmetric=null;
      

      var promises:any=[];
      
      for (var j=0;j<options.targets.length;j++){
   


        if (_.isEmpty(options.targets[j].druidDS) || ( (_.isEmpty(options.targets[j].aggregators) &&  _.isEmpty(options.targets[j].aggregators1) ) && options.targets[j].queryType !== "select") )  {
                console.log("options.targets[j].druidDS: " + options.targets[j].druidDS + ", options.targets[j].aggregators: " + options.targets[j].aggregators+options.targets[j].aggregators1);
                var d = dataSource.q.defer();
                d.resolve([]);
                return d.promise;
        } 

         var aggregators= dataSource._merge(options.targets[j].aggregators,options.targets[j].aggregators1);
         var postAggregators = dataSource._merge(options.targets[j].postAggregators,options.targets[j].postAggregators1);
         
         refId_MetricNames.push(
          _.map(DruidDatasource.getMetricNames(aggregators, postAggregators), function(x) {

         
             var tmp:any={};
             tmp[options.targets[j].refId]=x;
             return tmp;
                  

            })

          );


    
     

      var maxDataPointsByResolution = options.maxDataPoints;
      var maxDataPointsByConfig = options.targets[j].maxDataPoints ? options.targets[j].maxDataPoints : Number.MAX_VALUE;
      var maxDataPoints = Math.min(maxDataPointsByResolution, maxDataPointsByConfig);
      console.log("maxDataPoints",maxDataPoints);

      
      var granularity = null;
      var granularity1=null;
    
      


      
      if (options.targets[j].queryType=="topNJoin") {
         // topNJoinExpression=options.targets[j].topNJoinExpression;
        //  druidmetric=options.targets[j].druidMetric;

          var date_from = options.range.from.clone();
          var date_to = options.range.to.clone();

         dataSource._timeShiftFromTo(options.targets[j],"back", date_from,date_to);


          var from = DruidDatasource.dateToMoment(date_from, false);
          var to = DruidDatasource.dateToMoment(date_to, true);

        //  console.log("from",from);
       //   topNJoinLimit=options.targets[j].limit;
          if (options.targets[j].shouldOverrideGranularity)  granularity = _.find(DruidDatasource.GRANULARITIES, (entry) => { return entry[0] === options.targets[j].customGranularity});
          else   granularity = dataSource.computeGranularity(from, to, maxDataPoints);
           if (options.targets[j].shouldOverrideGranularity)
          granularity1 = _.find(DruidDatasource.GRANULARITIES, (entry) => { return entry[0] === options.targets[j].customGranularity1});
          else granularity1 = dataSource.computeGranularity(from, to, maxDataPoints);
          var roundedFrom = granularity[0] === "all" ? from : dataSource.roundDownStartTime(from, granularity[0]);
          var roundedFrom1 = granularity1[0] === "all" ? from : dataSource.roundDownStartTime(from, granularity1[0]);

          if ( (options.targets[j].filters1.length>0 && options.targets[j].filters.length >0) || (options.targets[j].filters1.length==0 && options.targets[j].filters.length >0) )  {
          console.log("granularityies",granularity[2],granularity1[2]);
            promises.push(dataSource._doQuery(roundedFrom, to, granularity[2], options.targets[j])) ;
            promises.push(dataSource._doQuery(roundedFrom1, to, granularity1[2], options.targets[j],true)) ;

          }  else throw "Please fill the first filter section at least!..";

      } else { 

        var date_from = options.range.from.clone();
        var date_to = options.range.to.clone();
    
        
        dataSource._timeShiftFromTo(options.targets[j],"back", date_from,date_to);


        var from = DruidDatasource.dateToMoment(date_from, false);
        var to = DruidDatasource.dateToMoment(date_to, true);
        console.log("from",from);

        if (options.targets[j].shouldOverrideGranularity)
        granularity = _.find(DruidDatasource.GRANULARITIES, (entry) => { return entry[0] === options.targets[j].customGranularity});
       else
        granularity = dataSource.computeGranularity(from, to, maxDataPoints);

      //Round up to start of an interval
      //Width of bar chars in Grafana is determined by size of the smallest interval
        var roundedFrom = granularity[0] === "all" ? from : dataSource.roundDownStartTime(from, granularity[0]);




        promises.push(dataSource._doQuery(roundedFrom, to, granularity[2], options.targets[j]));







      }

     





    }





     /* var promises = options.targets.map(function (target) {
      var date_from = options.range.from.clone();
      var date_to = options.range.to.clone();
      //console.log("target.timeShift",target.timeShift);
      //console.log("target.prePostAgg",target.currentPrePostAgg);
        
      dataSource._timeShiftFromTo(target,"back", date_from,date_to);


      var from = DruidDatasource.dateToMoment(date_from, false);
      var to = DruidDatasource.dateToMoment(date_to, true);


      if (_.isEmpty(target.druidDS) || ( (_.isEmpty(target.aggregators) &&  _.isEmpty(target.aggregators1) ) && target.queryType !== "select") )  {
              console.log("target.druidDS: " + target.druidDS + ", target.aggregators: " + target.aggregators+target.aggregators1);
              var d = dataSource.q.defer();
              d.resolve([]);
              return d.promise;
      } 

       var aggregators= dataSource._merge(target.aggregators,target.aggregators1);
       var postAggregators = dataSource._merge(target.postAggregators,target.postAggregators1);
       
       refId_MetricNames.push(
        _.map(DruidDatasource.getMetricNames(aggregators, postAggregators), function(x) {

       
         var tmp:any={};
         tmp[target.refId]=x;
         return tmp;
              

        })

      );


    
     // console.log("target.postAggregatorsss",target.postAggregators,target.postAggregators1);

      var maxDataPointsByResolution = options.maxDataPoints;
      var maxDataPointsByConfig = target.maxDataPoints ? target.maxDataPoints : Number.MAX_VALUE;
      var maxDataPoints = Math.min(maxDataPointsByResolution, maxDataPointsByConfig);
      var granularity = null;
      if (target.shouldOverrideGranularity)
        granularity = _.find(DruidDatasource.GRANULARITIES, (entry) => { return entry[0] === target.customGranularity});
      else
        granularity = dataSource.computeGranularity(from, to, maxDataPoints);

      //Round up to start of an interval
      //Width of bar chars in Grafana is determined by size of the smallest interval
      var roundedFrom = granularity[0] === "all" ? from : dataSource.roundUpStartTime(from, granularity[0]);

      return dataSource._doQuery(roundedFrom, to, granularity[2], target);
     
      });
*/

 



      return dataSource.q.all(promises).then(function (results) {

        var res = _.flatten(results);
       // console.log("resultData",res);
     
        var resTopNJoin=_.filter(res, function(x){
          return x.topNJoinData;
        })

         var resNonTopNJoin=_.filter(res, function(x){
          return !x.topNJoinData;
        })

        res.splice(0);

        if ( resTopNJoin.length>0 ) {
          resTopNJoin= dataSource.handleTopNJoinData(resTopNJoin);
          dataSource._applyTimeShiftToData(resTopNJoin);
        //  return {data:tmp_res};

         }

        if (resNonTopNJoin.length>0){
          //   console.log("resNonTopNJoin",resNonTopNJoin);
                dataSource.crossPostAggsCalculator(resNonTopNJoin);
                
                var  resNonTopNJoin=_.filter(resNonTopNJoin,function(x){
                if (typeof x.refId == "undefined") return true;
                for (var i =0;i< _.flatten(refId_MetricNames).length;i++) {
                      var tmp:any={};
                      tmp[x.refId]=x.target;
                      if (_.isEqual(_.flatten(refId_MetricNames)[i],tmp)) return true;


                }
                return false;

         });

            dataSource._applyTimeShiftToData(resNonTopNJoin);

        }
       

          return {data: resNonTopNJoin.concat(resTopNJoin)};

      
    });


  }

  _doQuery(from, to, granularity, target, secondFilter?:boolean) {
    
    var filterIndex=null;
    if (typeof secondFilter == "undefined") {
      secondFilter=false;
      filterIndex=0;
    } else filterIndex=1;
     
   console.log("granularity.period",granularity.period);
    var period={};
    if (granularity.period) period[granularity.period] =filterIndex; 
    else period["all"]=filterIndex;

    console.log("period",period);

    console.log("target.filteron",target.filterOn);

    var self = this;
    var datasource = target.druidDS;
    var filters = secondFilter? target.filters1:target.filters;
    
    console.log("filters",target.filters,target.filters1);
    //target.postAggregators=target.postAggregators||[];
    var aggregators= this._merge(target.aggregators,target.aggregators1);
    var postAggregators = this._merge(target.postAggregators,target.postAggregators1);


   for (var i=0;i<postAggregators.length;i++) {

      var parse_tree:any; 
      parse_tree=jsep(postAggregators[i].expression);
      
      var  keys:any=[],refid:any=[];
      this._parseObjectKeys(parse_tree,"name",keys,refid)

      postAggregators[i]["refId"]=refid;
      postAggregators[i]["refKey"]=keys;

  };
    //console.log("lookups",target.lookups);

    var groupBy = target.groupBy;
    console.log("original groupBy: " + JSON.stringify(groupBy));
    var interpolatedGroupBy = _.map(groupBy, (e) => {
      return this.templateSrv.replace(String(e).replace(/^\s+|\s+$/g, ''), null, 'regex')
    }).filter(e => e != "--");
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
      var lookups:any=[];
      if (target.lookups) lookups=target.lookups;
      /*if (target.lookups) {
        var tmpDim;
        if (tmpDim=_.find(target.lookups,function(x){
        return  x.dimension==target.dimension;

        })) dimension=tmpDim;

      }
      console.log("dimension",dimension);*/
      promise = this._topNQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension,lookups)
        .then(function (response) {
          return self.convertTopNData(response.data, dimension, metric, target);
        });
    }

    else if (target.queryType === 'topNJoin') {
      var threshold:any = target.limit;
      if (secondFilter) threshold=99999;
      var metric = target.druidMetric;
      var dimension = target.dimension;
      var lookups:any=[];
      if (target.lookups) lookups=target.lookups;
      /*if (target.lookups) {
        var tmpDim;
        if (tmpDim=_.find(target.lookups,function(x){
        return  x.dimension==target.dimension;

        })) dimension=tmpDim;

      }
      console.log("dimension",dimension);*/
      promise = this._topNJoinQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension, lookups)
        .then(function (response) {
          return self.convertTopNData(response.data, dimension, metric, target, period);
        });
    }






    else if (target.queryType === 'groupBy') {
       var lookups:any=[];
       if (target.lookups) lookups=target.lookups;
      limitSpec = DruidDatasource.getLimitSpec(target.limit, target.orderBy);
      promise = this._groupByQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec,lookups)
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
      var lookups:any=[];
       if (target.lookups) lookups=target.lookups;
      promise = this._timeSeriesQuery(datasource, intervals, granularity, filters, aggregators, postAggregators,lookups)
        .then(function (response) {
          return DruidDatasource.convertTimeSeriesData(response.data,allMetricNames,target);
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
        if (!_.isEmpty(metric.datapoints[0]) && metric.datapoints[0][1] < fromMs) {
          metric.datapoints[0][1] = fromMs;
        }
      });
      return metrics;
    });
  }

  _selectQuery(datasource, intervals, granularity, dimension, metric, filters, selectThreshold) {
    var query = {
      "queryType": "select",
      "dataSource": datasource,
      "granularity": granularity,
      "pagingSpec": {"pagingIdentifiers": {}, "threshold": selectThreshold},
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
  }

  _timeSeriesQuery(datasource, intervals, granularity, filters, aggregators, postAggregators,lookups) {

    var self=this;

    var query = {
      "queryType": "timeseries",
      "dataSource": datasource,
      "granularity": granularity,
      "aggregations": aggregators,
      "postAggregations": _.map(postAggregators, (e) => e.druidQuery),
      "intervals": intervals
    };

    if (filters && filters.length > 0) {
      var f = this.buildFilterTree(filters);
      if (f)
        query["filter"] = f;
        // console.log("filterafter",_.cloneDeep( f));
       //var new_f=_.cloneDeep(f);   
       var filterDimList=this.findObjetVal(filters,"dimension");
        filterDimList.forEach(function(y){
             var tmpDim;
             if (tmpDim=_.find(lookups,function(x){
               return  x.dimension==y;

             })) {
               self.delAndMergeObject(f,"dimension",y,tmpDim);

            }

        });



    }
    return this._druidQuery(query);
  }

  _topNQuery(datasource, intervals, granularity, filters, aggregators, postAggregators,
             threshold, metric, dimension,lookups) {
    var self=this;
    console.log("lookups",lookups);
    var dim:any={"dimension":dimension};

    var tmpDim;
    if (tmpDim=_.find(lookups,function(x){
      return  x.dimension==dimension;

    })) {
      dim=tmpDim;
    }
      


    var query = {
      "queryType": "topN",
      "dataSource": datasource,
      "granularity": granularity,
      "threshold": threshold,
      "dimension": dim,
      "metric": metric,
      // "metric": {type: "inverted", metric: metric},
      "aggregations": aggregators,
      "postAggregations": _.map(postAggregators, (e) => e.druidQuery),
      "intervals": intervals
    };

   // _.defaults(query,dim);

  //  console.log("query",query);
    if (filters && filters.length > 0) {
      var f = this.buildFilterTree(filters);
      if (f)
        query["filter"] = f;

        var filterDimList=this.findObjetVal(filters,"dimension");
        //console.log("filterDimList",filterDimList);
        filterDimList.forEach(function(y){
             var tmpDim;
             if (tmpDim=_.find(lookups,function(x){
               return  x.dimension==y;

             })) {
           
               self.delAndMergeObject(f,"dimension",y,tmpDim);

            }

        });


      
    }
    console.log("this._druidQuery",this._druidQuery(query) );
    return this._druidQuery(query);
  }

  _topNJoinQuery(datasource, intervals, granularity, filters, aggregators, postAggregators,
             threshold, metric, dimension,lookups) {
    var self=this;
    console.log("lookups",lookups);
    var dim:any={"dimension":dimension};
     console.log("granularity in query",granularity);
    var tmpDim;
    if (tmpDim=_.find(lookups,function(x){
      return  x.dimension==dimension;

    })) {
      dim=tmpDim;
    }
      


    var query = {
      "queryType": "topN",
      "dataSource": datasource,
      "granularity": granularity,
      "threshold": threshold,
      "dimension": dim,
      "metric": metric,
      // "metric": {type: "inverted", metric: metric},
      "aggregations": aggregators,
      "postAggregations": _.map(postAggregators, (e) => e.druidQuery),
      "intervals": intervals
    };

   // _.defaults(query,dim);

  //  console.log("query",query);
    if (filters && filters.length > 0) {
      var f = this.buildFilterTree(filters);
      if (f)
        query["filter"] = f;

        var filterDimList=this.findObjetVal(filters,"dimension");
        //console.log("filterDimList",filterDimList);
        filterDimList.forEach(function(y){
             var tmpDim;
             if (tmpDim=_.find(lookups,function(x){
               return  x.dimension==y;

             })) {
           
               self.delAndMergeObject(f,"dimension",y,tmpDim);

            }

        });


      
    }
    console.log("this._druidQuery",this._druidQuery(query) );
    return this._druidQuery(query);
  }

  _groupByQuery(datasource, intervals, granularity, filters, aggregators, postAggregators,
                groupBy, limitSpec, lookups) {
    var self=this;

    var dims:any=[];
    groupBy.forEach(function(y){
      var tmpDim;
        if (tmpDim=_.find(lookups,function(x){
          return  x.dimension==y;

        })) {
          dims.push(tmpDim);
        }


    });
    
     if (dims.length==0) dims=groupBy;

    var query = {
      "queryType": "groupBy",
      "dataSource": datasource,
      "granularity": granularity,
      "dimensions": dims,
      "aggregations": aggregators,
      "postAggregations": _.map(postAggregators, (e) => e.druidQuery),
      "intervals": intervals,
      "limitSpec": limitSpec
    };

    if (filters && filters.length > 0) {
      var f = this.buildFilterTree(filters);
      if (f)
        query["filter"] = f;


        var filterDimList=this.findObjetVal(filters,"dimension");
        filterDimList.forEach(function(y){
             var tmpDim;
             if (tmpDim=_.find(lookups,function(x){
               return  x.dimension==y;

             })) {
              
               self.delAndMergeObject(f,"dimension",y,tmpDim);

            }

        });



    }

    //console.log(" this._druidQuery(query)", this._druidQuery(query));
    return this._druidQuery(query);
  };

  _sqlQuery(datasource, columns, where, group_by, having, order_by, limit, offset) {
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

  }

  
   findObjetVal(obj, prop){

        var found_list=[];
        if (obj instanceof Object){
            for (var p in obj) {
                if (p == prop)  found_list.push(obj[p]);
                else  found_list=found_list.concat(this.findObjetVal(obj[p],prop));
            }

        }
        return found_list;
    
  }



  replaceObjectVal(obj, prop, source_val, targ_val) {
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                if (p === prop &&  obj[p]==source_val ) {
                    obj[p]=targ_val;
                    return null;
                } else if (obj[p] instanceof Object ) return this.replaceObjectVal(obj[p], prop, source_val,targ_val);
                
            }
        }
       
    }

    delAndMergeObject(obj, prop, source_val, targ_val) {
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                if (p === prop &&  obj[p]==source_val ) {
                    _.defaults(obj,targ_val)
                    return ;
                } else if (obj[p] instanceof Object )  this.delAndMergeObject(obj[p], prop, source_val,targ_val);
                
            }
        }
       
    }

  _merge(componet1:any,componet2:any) {

    componet1=componet1||[];
    componet2=componet2||[];
   // if (typeof componet1 =="undefined") componet1=[];
    // if (typeof componet2 =="undefined") componet2=[];
   /* componet1= (typeof  componet1!= "undefined" ) ?  componet1:[];
    componet2= (typeof  componet2!= "undefined" ) ?  componet2 :[];
      */
    
    return componet1.concat(componet2);


  }
  
   
    _parseObjectKeys (obj,name,keys,refid?) {
      for (var prop in obj) {
        if (prop=="object" ) {
          var tmp:any={};
          tmp[obj.object.name]=obj.property.name;
          refid.push(tmp);
      }
        //  refid[obj.object.name]=obj.property.name;
        else if (prop=="property" ) continue;
        else {var sub = obj[prop];
                 // console.log("prop[name]",prop);
        if (prop==name) {
            keys.push(obj[name]);
          } 
        }
        if ( typeof(sub) == "object") {
          this._parseObjectKeys(sub,name,keys,refid);
        }
      }
   }      


  _parseTimeShift(target){
           
            if (target.timeShift) {
            //var myRegexp = /^(\+\d+|-\d+|\d+)(d|h){1}$/g;
            var myRegexp = /^(\d+|\+\d+)(d|h){1}$/g;
            var match = myRegexp.exec(target.timeShift);
             if (match) return match;
             else return null;
            } else return null;
    }

  _timeShiftFromTo (target,backOrforth,from,to?) {
             
          if (target.timeShift) {
        
          var match=this._parseTimeShift(target)
          var direction=null;
          if (backOrforth=="back") direction=-1;
          else if (backOrforth=="forth") direction=1;
          else return;
        
          if (!match) {
            target.timeShift=undefined
            return;
           
          } 
           
             
          if (match[2] =="d") { 

            from.add((direction)*Number(match[1]),"days");
           if (typeof to !== 'undefined') to.add((direction)*Number(match[1]),"days");
            
          } 
          else if (match[2] =="h") {  
            from.add((direction)*Number(match[1]),"hours");
            if (typeof to !== 'undefined')  to.add((direction)*Number(match[1]),"hours");
          
          } 

      
          }
           
    }

  _applyTimeShiftToData(res:any) {
    var self = this;
    res.forEach(function(x,idx) {
         
              if  (x.timeShift) {
                var str="&#9716;"
                str=$("<div/>").html(str).text();
               // x.target=x.target+'<span style="color:#4d79ff">'+" ("+str+"-"+x.timeShift+")" +"</span>";
                x.target=  x.target+ " ("+str+"-"+x.timeShift+")";
              }
            

              x.datapoints.forEach(function (y){
                var date=DruidDatasource.dateToMoment(new Date(y[1]), false);
                  
                self._timeShiftFromTo(x,"forth",date);
                if (x.timeShift) y[1]=date.valueOf();

              });

        });
  }

  static buildColumns(columns) {
    return columns.join(", ");
  }

  _druidQuery(query) {
    var options = {
      method: 'POST',
      url: this.url + '/druid/v2/?pretty',
      data: query
    };
    console.log("Make http request");
    console.log(JSON.stringify(options));
 //   console.log("this.backendSrv.datasourceRequest(options)",this.backendSrv.datasourceRequest(options));
    return this.backendSrv.datasourceRequest(options);
  };

  static getLimitSpec(limitNum, orderBy) {
    return {
      "type": "default",
      "limit": limitNum,
      "columns": !orderBy ? null : orderBy.map(function (col) {
        return {"dimension": col, "direction": "DESCENDING"};
      })
    };
  }

  buildFilterTree(filters) {
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
       else if (filter.type == "in")
        return self.replaceTemplateValues(filter, ['values']);
    })
      .map(function (filter) {
        var finalFilter = _.omit(filter, 'negate');
        if (filter && "negate" in filter && filter.negate) {
          return {"type": "not", "field": finalFilter};
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
  }

  static getQueryIntervals(from, to) {
    return [from.toISOString() + '/' + to.toISOString()];
  }

  static getMetricNames(aggregators, postAggregators) {
    var displayAggs = _.filter(aggregators, function (agg) {
      return agg.display && agg.type !== 'approxHistogramFold';
    });
    return _.union(_.map(displayAggs, 'name'), _.map(postAggregators, 'name'));
  }
  static getAllMetricNames (aggregators, postAggregators) {
    var displayAggs = _.filter(aggregators, function (agg) {
      return /*agg.display &&*/ agg.type !== 'approxHistogramFold';
    });
    return _.union(_.map(displayAggs, 'name'), _.map(postAggregators, 'name'));
  };

  static formatTimestamp(ts) {
    return moment(ts).format('X') * 1000;
  }

  static convertTimeSeriesData (md, metrics, trg) {
  
      return metrics.map(function (metric) {
        var postagg:any={};
        var ref_agg,exp,refkey:any=[];
        trg.postAggregators=trg.postAggregators||[];
        trg.postAggregators1=trg.postAggregators1||[];
        var combined_postaggs=trg.postAggregators.concat(trg.postAggregators1);
        if (postagg=_.find(combined_postaggs,function(x) {
          return x.name==metric;
        }) ) {
           ref_agg=postagg.refId;
           exp= postagg.expression;
          if (postagg.refKey) refkey=postagg.refKey; //if (postagg.refKey.length==1) refkey=postagg.refKey[0];
        }
         
        return {
          target: metric,
          timeShift:trg.timeShift,
          refId: trg.refId,
          refAgg:ref_agg,
          refKey: refkey,
          expression:exp,
          datapoints: md.map(function (item) {
            return [item.result[metric], DruidDatasource.formatTimestamp(item.timestamp)];
          })
        };
      });
  };

  static getGroupName(groupBy, metric) {
    return groupBy.map(function (dim) {
      return metric.event[dim];
    })
      .join("-");
  }

  convertTopNData(md, dimension, metric, trg, period?:any) {

   // if (typeof period =="undefined") ;
  //  console.log("mdfirst ",md);
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
     //Get the list of all distinct dimension values for the entire result set
    var dVals = md.reduce(function (dValsSoFar, tsItem) {
      var dValsForTs = _.map(tsItem.result, dimension);
      return _.union(dValsSoFar, dValsForTs);
    }, {});
    //console.log("Dvals",dVals);

    //Add null for the metric for any missing dimension values per timestamp result
    md.forEach(function (tsItem) {
      var dValsPresent = _.map(tsItem.result, dimension);
      var dValsMissing = _.difference(dVals, dValsPresent);
      dValsMissing.forEach(function (dVal) {
        var nullPoint = {};
        nullPoint[dimension] = dVal;
        nullPoint[metric] = null;
        tsItem.result.push(nullPoint);
      });
      return tsItem;
    });


    //Re-index the results by dimension value instead of time interval
    //console.log("mddd",md);

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

      var keys = _.map(item.result, dimension);
    
      var vals = _.map(item.result, metric).map(function (val) {
        if (period) return [val, timestamp];
        return [val, timestamp];
      });
  
      // console.log("_.zipObject(keys, vals)",_.zipObject(keys, vals));
      return _.zipObject(keys, vals);
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
        return _.assignWith(prev, curr, function (pVal, cVal) {
          if (pVal) {
            pVal.push(cVal);
            return pVal;
          }
          return [cVal];
          });
      }, {});
   //   console.log("mergedData",mergedData);

    //Convert object keyed by dimension values into an array
    //of objects {target: <dimVal>, datapoints: <metric time series>}
    return _.map(mergedData, function (vals, key) {
       /* 
        var postagg:any={};
        var ref_agg,exp,refkey:any=[];
        trg.postAggregators=trg.postAggregators||[];
        trg.postAggregators1=trg.postAggregators1||[];
        var combined_postaggs=trg.postAggregators.concat(trg.postAggregators1);
        if (combined_postaggs.length==1){
           ref_agg=combined_postaggs[0].refId;
           exp= combined_postaggs[0].expression;
            if (combined_postaggs[0].refKey) refkey=combined_postaggs[0].refKey; 
        }*/


       /* if (postagg=_.find(combined_postaggs,function(x) {
          console.log("x name and key",x.name,key);
          return x.name==key;
        }) ) {
           ref_agg=postagg.refId;
           exp= postagg.expression;
          if (postagg.refKey) refkey=postagg.refKey; //if (postagg.refKey.length==1) refkey=postagg.refKey[0];
        
        }*/

      var  topNJoinData={
          expression:trg.topNJoinExpression,
           period:period,
          metric:metric

      }

if (trg.queryType!="topNJoin") topNJoinData=null;

      return {
       /* timeShift:trg.timeShift,
        refId: trg.refId,
        refAgg:ref_agg,
        refKey: refkey,
        expression:exp, */
        timeShift:trg.timeShift,
        topNJoinData:topNJoinData,
      //  expression:trg.topNJoinExpression,
       // period:period,
      // queryType:trg.queryType,
        target: key,
        datapoints: vals
      };
    });
  }

  convertGroupByData(md, groupBy, metrics) {

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
     
      return _.zipObject(keys, vals);
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
        return _.assignWith(prev, curr, function (pVal, cVal) {
          if (pVal) {
            pVal.push(cVal);
            return pVal;
          }
          return [cVal];
        });
      }, {});

    return _.map(mergedData, function (vals, key) {

      

      /*
       Second map converts the aggregated object into an array
       */
      return {
        target: key,
        datapoints: vals
      };
    });
  }

  convertSelectData(data) {
    var resultList = _.map(data, "result");
    var eventsList = _.map(resultList, "events");
    var eventList = _.flatten(eventsList);
    var result = {};
    for (var i = 0; i < eventList.length; i++) {
      var event = eventList[i].event;
      var timestamp = event.timestamp;
      if (_.isEmpty(timestamp)) {
        continue;
      }
      for (var key in Object.keys(event)) {
        if (key !== "timestamp") {
          if (!result[key]) {
            result[key] = {"target": key, "datapoints": []};
          }
          result[key].datapoints.push([event[key], timestamp]);
        }
      }
    }
    return _.values(result);
  }

  static dateToMoment(date, roundUp) {
    if (date === 'now') {
      return moment();
    }
    date = dateMath.parse(date, roundUp);
    return moment(date.valueOf());
  }

  computeGranularity(from, to, maxDataPoints) {
    var intervalSecs = to.unix() - from.unix();
    /*
     Find the smallest granularity for which there
     will be fewer than maxDataPoints
     */
    var granularityEntry = _.find(DruidDatasource.GRANULARITIES, function (gEntry) {
      if (gEntry[0] == "all")
        return true;
      return Math.ceil(intervalSecs / gEntry[1].asSeconds()) <= maxDataPoints;
    });
    if (granularityEntry[0] != "all")
      console.log("Calculated \"" + granularityEntry[0] + "\" granularity [" + Math.ceil(intervalSecs / granularityEntry[1].asSeconds()) +
                  " pts]" + " for " + (intervalSecs / 60).toFixed(0) + " minutes and max of " + maxDataPoints + " data points");
    return granularityEntry;
  }

  roundUpStartTime(from, granularity) {
    var duration = _.find(DruidDatasource.GRANULARITIES, function (gEntry) {
      return gEntry[0] === granularity;
    })[1];
    var rounded = moment(Math.ceil((+from) / (+duration)) * (+duration));

    console.log("Rounding up start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
    return rounded;
  }



roundDownStartTime(from, granularity) {
    var duration = _.find(DruidDatasource.GRANULARITIES, function (gEntry) {
      return gEntry[0] === granularity;
    })[1];
    var rounded = moment(Math.floor((+from) / (+duration)) * (+duration));
    console.log("Rounding down start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
    return rounded;
  }


  roundDownStartTimev2(from, duration) {
   /**/
    var rounded = moment(Math.floor((+from) / (+duration)) * (+duration));
   // console.log("Rounding down start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
    return rounded;
  }
/*
roundDownStartTime(from, granularity) {
    // var duration = _.find(DruidDatasource.GRANULARITIES, function (gEntry) {
    //   return gEntry[0] === granularity;
    // })[1];
   // console.log("duration",duration);
    return from.startOf(granularity);//moment(Math.floor((+from) / (+duration)) * (+duration));
   // console.log("Rounding down start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
    
  }
*/


/*    (time, granularity){
 if (granularity.trim()=="thirty_minute" ) time.add(30,"minutes");
 else if (granularity.trim()=="thirteen_minute" )   time.add(15,"minutes");
 else if (granularity.trim()=="five_minute" )  time.add(5,"minutes");
 else time.add(1,granularity);


  }*/

  addDuration(time, duration, granularity){
 if (granularity.trim().charAt(0)=="h" ) time.add(duration,"hours");
 else if (granularity.trim().charAt(0)=="d" ) time.add(duration,"days");
 
 


  }

convertisoDateTime(str:String ){
  var tmp = moment.duration(str).asSeconds;
  if (tmp == 60 ) return "minute";
  else if (tmp == 60*60) return "hour";
  else if (tmp == 60*60*24) return "day";
 else if (tmp == 2592000) return "month";
 else if (tmp== 31536000) return "year";


}



 checkDate = date => {
  if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.valueOf()))
    throw new TypeError('Invalide date')
}

map = (mapper, object) => {
  const target = {}
  for (let key in object)
    if (object.hasOwnProperty(key))
      target[key] = mapper(object[key], key, object)
  return target
}


parseDuration (duration) {
  let parsed

  if (duration)
    duration.replace(this.durationRegex, (_, sign, year, month, day, hour, minute, second, week) => {
      sign = sign ? -1 : 1
      const toNumber = num => parseInt(num, 10) * sign || 0
      parsed = this.map(toNumber, { year, month, day, hour, minute, second, week })
    })

  if (!parsed)
    throw new Error(`Invalid duration "${duration}"`)

  return Object.assign(parsed, {
    /**
     * Sum or substract parsed duration to given date using UTC logic
     * Time in the day may be affected by daylight saving time (DST)
     * Time interval between the date given and returned will be stricly equal to duration
     *
     * @param {Date} date: Any valid date
     * @throws {TypeError} When date is not valid
     * @returns {Date} New date with duration difference
     */
    addUTC(date) {
      this.checkDate(date);
      return new Date(Date.UTC(
        date.getUTCFullYear() + parsed.year,
        date.getUTCMonth() + parsed.month,
        date.getUTCDate() + parsed.day + parsed.week * 7,
        date.getUTCHours() + parsed.hour,
        date.getUTCMinutes() + parsed.minute,
        date.getUTCSeconds() + parsed.second,
        date.getUTCMilliseconds()
      ))
    },

    /**
     * Sum or substract parsed duration to date
     * Time in the day won't be affected by daylight saving time (DST)
     * Time interval between the date given and returned may be affected by DST and not equal to duration
     *
     * @param {Date} date: Any valid date
     * @throws {TypeError} When date is not valid
     * @returns {Date} New date with duration difference
     */
    add(date) {
      this.checkDate(date);
      return new Date(
        date.getFullYear() + parsed.year,
        date.getMonth() + parsed.month,
        date.getDate() + parsed.day + parsed.week * 7,
        date.getHours() + parsed.hour,
        date.getMinutes() + parsed.minute,
        date.getSeconds() + parsed.second,
        date.getMilliseconds()
      )
    }
  })
}


}

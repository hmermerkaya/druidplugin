# Grafana plugin for [Druid](http://druid.io/) real-time OLAP database

![Screenshot](https://raw.githubusercontent.com/grafana-druid-plugin/druidplugin/master/img/AddDataSource.png)
![Screenshot](https://raw.githubusercontent.com/grafana-druid-plugin/druidplugin/master/img/ListDataSource.png)
![Screenshot](https://github.com/hmermerkaya/druidplugin/blob/master/img/DruidPanel_new.png)

## Requires
* **Grafana** > 3.x.x

## Status

This plugin is built on the top of an existing Druid plugin (https://github.com/grafana/grafana-plugins)  which used to work on older Grafana versions. With the UI changes done on Grafana-3.0 the existing plugin stopped working. Lot of changes have been made to have it work on Grafana 3.0. It supports timeseries, group by, topN and Select queries.

It supports Grafana 4.1.1.

Lot of features might still not be implemented. Your contributions are welcome.
 

## Plugin development history

This plugin was originally developed by Quantiply Corporation (Supported for Grafana versions < 2.5): https://github.com/grafana/grafana-plugins/tree/master/datasources/druid

This plugin was further enhanced by Carl Bergquist (https://github.com/grafana/grafana/pull/3328) (to support it on Grafana version 2.5 & 2.6).

I cloned the source from the Pull Request by Carl Bergquist and changed the plugin to have it work on Grafana-3.0.

All the credits for the original code and enahcement to 2.5 goes to Quantiply and Carl Bergquist.

Opensourcing all the changes done to the plugin to support Grafana-3.0.

New features implemented by Hamit Mermerkaya; 

1. Shifting time forward so that one can compare for an instance the data of the last week  with that of this week in the same time period.

2. Implementing predefined post aggregations and their relevant aggregations read from json file sitting in dist folder with the same name as that of druid datasource.

3. Implementing post aggregation in which either of the aggregations could exist in different datasources. Aggregations from different datasource can be invoked by object-property notation. For example in a datasource labeled as "A"  and an aggreation named "agg1", it is 'A.agg1'. Sample usage  is in the DruidPanel screenshot.

4. Some changes have been made to have it work on Grafana 4.1.1

# Licenses
- Licensed under the Apache License, Version 2.0
- JavaScript Expression Parser http://jsep.from.so -- MIT license

# Credits
- Quantiply Corporation
- Carl Bergquist
- Abhishek Sant
- Kenji Noguchi, Verizon Digital Media Services
- Hamit Mermerkaya

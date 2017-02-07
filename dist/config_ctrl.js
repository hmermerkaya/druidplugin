///<reference path="app/headers/common.d.ts" />
System.register([], function (exports_1, context_1) {
    "use strict";

    var __moduleName = context_1 && context_1.id;
    var DruidConfigCtrl;
    return {
        setters: [],
        execute: function () {
            DruidConfigCtrl = function () {
                function DruidConfigCtrl() {}
                DruidConfigCtrl.templateUrl = 'partials/config.html';
                return DruidConfigCtrl;
            }();
            exports_1("DruidConfigCtrl", DruidConfigCtrl);
        }
    };
});
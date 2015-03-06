/* jshint undef: true, unused: true, browser: true, sub: true */
/* exported Picotable */
/* global alert, require */
var Picotable = (function(m) {
    "use strict";
    m = m || require("mithril");

    var Util = (function() {
        function property(propertyName) {
            return function(obj) {
                return obj[propertyName];
            };
        }

        function map(obj, callback) {
            if (Array.isArray(obj)) return obj.map(callback);
            return Object.keys(obj).map(function(key) {
                return callback(obj[key], key, obj);
            });
        }

        function any(obj, callback) {
            if (Array.isArray(obj)) return obj.some(callback);
            return Object.keys(obj).some(function(key) {
                return callback(obj[key], key, obj);
            });
        }

        function extend(/*...*/) {
            var target = arguments[0];
            for (var i = 1; i < arguments.length; i++) {
                for (var key in arguments[i]) {
                    if (arguments[i].hasOwnProperty(key)) target[key] = arguments[i][key];
                }
            }
            return target;
        }

        function trim(value) {
            return ("" + value).replace(/^\s+|\s+$/g, '');
        }

        function omitNulls(object) {
            var outputObject = {};
            map(object, function(value, key) {
                if (value !== null) outputObject[key] = value;
            });
            return outputObject;
        }

        function debounce(func, wait, immediate) {
            var timeout;

            function cancel() {
                clearTimeout(timeout);
                timeout = null;
            }

            var debounced = function() {
                var context = this, args = arguments;
                var later = function() {
                    cancel();
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                cancel();
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
            debounced.cancel = cancel;
            return debounced;
        }

        function stringValue(obj) {
            if (obj === null || obj === undefined) return "";
            if (Array.isArray(obj) && obj.length === 0) return "";
            return "" + obj;
        }

        return {
            property: property,
            map: map,
            any: any,
            extend: extend,
            trim: trim,
            omitNulls: omitNulls,
            debounce: debounce,
            stringValue: stringValue,
        };
    }());

    var lang = {
        "RANGE_FROM": "from",
        "RANGE_TO": "to"
    };

    var cx = function generateClassName(classSet) {
        var classValues = [];
        Util.map((classSet || {}), function(flag, key) {
            var className = null;
            if (key === "") { // The empty string as a class set means the entire value is used if not empty
                className = (flag && flag.length ? "" + flag : null);
            } else {
                className = !!flag ? key : null;
            }
            if (!!className) classValues.push(className);
        });
        return classValues.join(" ");
    };

    function addDummies(pageLinks) {
        var nDummy = 0;
        for (var i = 1; i < pageLinks.length; i++) {
            if (pageLinks[i]._page != pageLinks[i - 1]._page + 1) {
                var li = m("li", {key: "dummy" + (nDummy++), className: "disabled"}, m("a", {href: "#"}, "\u22EF"));
                pageLinks.splice(i, 0, li);
                i++;
            }
        }
    }

    function paginator(paginationData, setPage) {
        if (paginationData.nItems === 0) return m("nav");
        var callback = m.withAttr("rel", setPage);
        var currentPage = paginationData.pageNum;
        var pageLinks = [];
        var pageLink = function(page, title) {
            return m("a", {rel: page, href: "#", onclick: callback}, title || page);
        };
        for (var page = 1; page <= paginationData.nPages; page++) {
            if (page == 1 || page == paginationData.nPages || Math.abs(page - currentPage) <= 4 || page % 10 === 0) {
                var li = m("li", {key: page, className: cx({active: currentPage == page})}, pageLink(page));
                li._page = page;
                pageLinks.push(li);
            }
        }
        addDummies(pageLinks);
        var prevLink = m("li", {key: "previous", className: cx({disabled: currentPage == 1})}, pageLink(currentPage - 1, "Previous"));
        var nextLink = m("li", {key: "next", className: cx({disabled: currentPage == paginationData.nPages})}, pageLink(currentPage + 1, "Next"));
        return m("nav", m("ul.pagination", prevLink, pageLinks, nextLink));
    }

    function debounceChangeConfig(timeout) {
        return function(el, isInit, context) {
            if (!isInit) {
                el.oninput = context.debouncedOnInput = Util.debounce(el.onchange, timeout);
                context.onunload = function() {
                    if (context.debouncedOnInput) {
                        context.debouncedOnInput.cancel();
                        context.debouncedOnInput = null;
                    }
                };
            }
        };
    }

    function buildColumnChoiceFilter(ctrl, col, value) {
        var setFilterValueFromSelect = function() {
            var valueJS = JSON.parse(this.value);
            ctrl.setFilterValue(col.id, valueJS);
        };
        var select = m("select.form-control", {value: JSON.stringify(value), onchange: setFilterValueFromSelect}, Util.map(col.filter.choices, function(choice) {
            return m("option", {value: JSON.stringify(choice[0]), key: choice[0]}, choice[1]);
        }));
        return m("div.choice-filter", select);
    }

    function buildColumnRangeFilter(ctrl, col, value) {
        var setFilterValueFromInput = function(which) {
            var value = Util.extend({}, ctrl.getFilterValue(col.id) || {}); // Copy current filter object
            var newValue = this.value;
            if (!Util.trim(newValue)) newValue = null;
            value[which] = newValue;
            ctrl.setFilterValue(col.id, value);
        };
        var attrs = {"type": col.filter.range.type || "text"};
        Util.map(["min", "max", "step"], function(key) {
            var val = col.filter.range[key];
            if (!(val === undefined || val === null)) {
                attrs[key] = val;
                attrs.type = "number";  // Any of these set means we're talking about numbers
            }
        });
        value = value || {};
        var minInput = m("input.form-control", Util.extend({}, attrs, {
            value: Util.stringValue(value.min),
            placeholder: lang["RANGE_FROM"],
            onchange: function() {
                setFilterValueFromInput.call(this, "min");
            },
            config: debounceChangeConfig(500)
        }));
        var maxInput = m("input.form-control", Util.extend({}, attrs, {
            value: Util.stringValue(value.max),
            placeholder: lang["RANGE_TO"],
            onchange: function() {
                setFilterValueFromInput.call(this, "max");
            },
            config: debounceChangeConfig(500)
        }));
        return m("div.row.range-filter", [m("div.col-xs-6", {key: "min"}, minInput), m("div.col-xs-6", {key: "max"}, maxInput)]);
    }

    function buildColumnTextFilter(ctrl, col, value) {
        var setFilterValueFromInput = function() {
            ctrl.setFilterValue(col.id, this.value);
        };
        var input = m("input.form-control", {
            type: col.filter.text.type || "text",
            value: Util.stringValue(value),
            placeholder: col.filter.placeholder || col.title,
            onchange: setFilterValueFromInput,
            config: debounceChangeConfig(500)
        });
        return m("div.text-filter", input);
    }

    function buildColumnFilter(ctrl, col) {
        var value = ctrl.getFilterValue(col.id);
        if (col.filter.choices) {
            return buildColumnChoiceFilter(ctrl, col, value);
        }
        if (col.filter.range) {
            return buildColumnRangeFilter(ctrl, col, value);
        }
        if (col.filter.text) {
            return buildColumnTextFilter(ctrl, col, value);
        }
    }

    function buildColumnHeaderCell(ctrl, col) {
        var sortIndicator = null;
        var classSet = {"": col.className};
        var columnOnClick = null;
        if (col.sortable) {
            var currentSort = ctrl.vm.sort();
            var thisColSort = null;
            if (currentSort == "+" + col.id) thisColSort = "asc";
            if (currentSort == "-" + col.id) thisColSort = "desc";
            var sortIcon = "fa-sort" + (thisColSort ? "-" + thisColSort : "");
            sortIndicator = m("i.fa." + sortIcon);
            classSet.sortable = true;
            if (thisColSort) classSet["sorted-" + thisColSort] = true;
            columnOnClick = function() {
                ctrl.setSortColumn(col.id);
            };
        }
        return m("th", {key: col.id, className: cx(classSet), onclick: columnOnClick}, [sortIndicator, " ", col.title]);
    }

    function buildColumnFilterCell(ctrl, col) {
        var filterControl = null;
        if (col.filter) {
            filterControl = buildColumnFilter(ctrl, col);
        }
        return m("th", {key: col.id, className: col.className || ""}, [filterControl]);
    }

    function PicotableView(ctrl) {
        var data = ctrl.vm.data();
        if (data === null) return; // Not loaded, don't return anything

        // Build header
        var columnHeaderCells = Util.map(data.columns, function(col) {
            return buildColumnHeaderCell(ctrl, col);
        });
        var columnFilterCells = (Util.any(data.columns, Util.property("filter")) ? Util.map(data.columns, function(col) {
            return buildColumnFilterCell(ctrl, col);
        }) : null);
        var thead = m("thead", [
            m("tr.headers", columnHeaderCells),
            (columnFilterCells ? m("tr.filters", columnFilterCells) : null)
        ]);

        // Build footer
        var footColspan = data.columns.length;
        var footCell = m("td", {colspan: footColspan}, paginator(data.pagination, ctrl.setPage));
        var tfoot = m("tfoot", [m("tr", footCell)]);

        // Build body
        var rows = Util.map(data.items, function(item) {
            return m("tr", {key: "item-" + item._id}, Util.map(data.columns, function(col) {
                var content = item[col.id] || "";
                if (!!col.raw) content = m.trust(content);
                if (col.linked && item._url) content = m("a", {href: item._url}, content);
                return m("td", {key: "col-" + col.id, className: col.className || ""}, [content]);
            }));
        });
        var tbody = m("tbody", rows);
        return m("table.table.table-condensed.table-striped", [thead, tfoot, tbody]);
    }

    function PicotableController() {
        var ctrl = this;
        ctrl.vm = {
            url: m.prop(null),
            sort: m.prop(null),
            filterEnabled: m.prop({}),
            filterValues: m.prop({}),
            page: m.prop(1),
            perPage: m.prop(20),
            data: m.prop(null)
        };
        ctrl.setSource = function(url) {
            ctrl.vm.url(url);
            ctrl.refreshSoon();
        };
        ctrl.setSortColumn = function(colId) {
            var currentSort = ctrl.vm.sort();
            if (currentSort == "+" + colId) ctrl.vm.sort("-" + colId);
            else if (currentSort == "-" + colId) ctrl.vm.sort(null);
            else ctrl.vm.sort("+" + colId);
            ctrl.refreshSoon();
        };
        ctrl.getFilterValue = function(colId) {
            return ctrl.vm.filterValues()[colId];
        };
        ctrl.setFilterValue = function(colId, value) {
            var filters = ctrl.vm.filterValues();
            if (typeof value === "string" && Util.trim(value) === "") value = null; // An empty string is invalid for filtering
            filters[colId] = value;
            filters = Util.omitNulls(filters);
            ctrl.vm.filterValues(filters);
            ctrl.refreshSoon();
        };
        ctrl.setPage = function(newPage) {
            newPage = 0 | newPage;
            if (isNaN(newPage) || newPage < 1) newPage = 1;
            ctrl.vm.page(newPage);
            ctrl.refreshSoon();
        };
        var refreshTimer = null;
        ctrl.refresh = function() {
            clearTimeout(refreshTimer);
            refreshTimer = null;
            var url = ctrl.vm.url();
            if (!url) return;
            var data = {
                sort: ctrl.vm.sort(),
                perPage: 0 | ctrl.vm.perPage(),
                page: 0 | ctrl.vm.page(),
                filters: ctrl.vm.filterValues(),
            };
            m.request({method: "GET", url: url, data: {"jq": JSON.stringify(data)}}).then(ctrl.vm.data, function() {
                alert("An error occurred.");
                ctrl.vm.data(null);
            });
        };
        ctrl.refreshSoon = function() {
            if (refreshTimer) return;
            refreshTimer = setTimeout(function() {
                ctrl.refresh();
            }, 20);
        };
    }


    var generator = function(container, dataSourceUrl) {
        this.ctrl = m.module(container, {view: PicotableView, controller: PicotableController});
        this.ctrl.setSource(dataSourceUrl);
    };
    generator.lang = lang;
    return generator;
}(window.m));
/* jshint ignore:start */
if (typeof module != "undefined" && module !== null && module.exports) module.exports = Picotable;
else if (typeof define === "function" && define.amd) define(function() {
    return Picotable;
});

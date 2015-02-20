var Picotable = (function(m) {
    m = m || require("mithril");
    var map = function(obj, callback) {
        if (Array.isArray(obj)) return obj.map(callback);
        return Object.keys(obj).map(function(key) {
            return callback(obj[key], key);
        });
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
        var callback = m.withAttr("rel", setPage);
        var currentPage = paginationData.pageNum;
        var pageLinks = [];
        var pageLink = function(page, title) {
            return m("a", {rel: page, href: "#", onclick: callback}, title || page);
        };
        for (var page = 1; page <= paginationData.nPages; page++) {
            if (page == 1 || page == paginationData.nPages || Math.abs(page - currentPage) <= 4 || page % 10 === 0) {
                var li = m("li", {key: page, className: currentPage == page ? "active" : null}, pageLink(page));
                li._page = page;
                pageLinks.push(li);
            }
        }
        addDummies(pageLinks);
        var prevLink = m("li", {key: "previous", className: currentPage == 1 ? "disabled" : null}, pageLink(currentPage - 1, "Previous"));
        var nextLink = m("li", {key: "next", className: currentPage == paginationData.nPages ? "disabled" : null}, pageLink(currentPage + 1, "Next"));
        return m("nav", m("ul.pagination", prevLink, pageLinks, nextLink));
    }

    function buildColumnFilter(ctrl, col) {
        var value = ctrl.vm.filterValues()[col.id];
        if(col.filter.choices) {
            var callback = function(value) {
                ctrl.setFilterValue(col.id, value);
            };
            var select = m("select.form-control", {value: value, onchange: m.withAttr("value", callback)}, map(col.filter.choices, function(choice) {
                return m("option", {value: choice[0], key: choice[0]}, choice[1]);
            }));
            return m("div", select);
        }
    }

    function buildColumnHeader(ctrl, col) {
        var sortButton = null, filterButton = null, filterPane = null;
        if(col.sortable) {
            var currentSort = ctrl.vm.sort();
            var thisColSort = null;
            if (currentSort == "+" + col.id) thisColSort = "asc";
            if (currentSort == "-" + col.id) thisColSort = "desc";
            var sortIcon = "fa-sort" + (thisColSort ? "-" + thisColSort : "");
            sortButton = m("a", {href: "#", rel: col.id, onclick: m.withAttr("rel", ctrl.setSortColumn)}, m("i.fa." + sortIcon));
        }
        if(col.filter) {
            var filterEnabled = !!ctrl.vm.filterEnabled()[col.id];
            filterButton = m("a", {href: "#", rel: col.id, onclick: m.withAttr("rel", ctrl.toggleFilter)}, [
                m("i.fa.fa-filter"),
                (filterEnabled ? m("i.fa.fa-sort-desc") : null)
            ]);
            filterPane = (filterEnabled ? buildColumnFilter(ctrl, col) : null);
        }
        return m("th", {key: col.id, className: col.className || ""}, [sortButton, " ", col.title, " ", filterButton, filterPane]);
    }

    function PicotableView(ctrl) {
        var data = ctrl.vm.data();
        if (data === null) return; // Not loaded, don't return anything

        var ths = map(data.columns, function(col) {
            return buildColumnHeader(ctrl, col);
        });
        var footColspan = ths.length;
        var foot = m("td", {colspan: footColspan}, paginator(data.pagination, ctrl.setPage));
        var rows = map(data.items, function(item, index) {
            return m("tr", {key: "item-" + item.id}, map(data.columns, function(col) {
                return m("td", {key: "col-" + col.id, className: col.className || ""}, [m.trust(item[col.id] || "")]);
            }));
        });
        var thead = m("thead", [m("tr", ths)]);
        var tfoot = m("tfoot", [m("tr", foot)]);
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
        ctrl.toggleFilter = function(colId) {
            var filters = ctrl.vm.filterEnabled();
            filters[colId] = !filters[colId];
            ctrl.vm.filterEnabled(filters);
            ctrl.refreshSoon();
        };
        ctrl.setFilterValue = function(colId, value) {
            var filters = ctrl.vm.filterValues();
            filters[colId] = value;
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
            var filters = {};
            map(ctrl.vm.filterEnabled(), function(enabled, colId) {
                if(enabled) filters[colId] = ctrl.vm.filterValues()[colId];
            });
            var data = {
                sort: ctrl.vm.sort(),
                perPage: 0 | ctrl.vm.perPage(),
                page: 0 | ctrl.vm.page(),
                filters: filters,
            };
            m.request({method: "GET", url: url, data: {"jq": JSON.stringify(data)}}).then(ctrl.vm.data, function() {
                alert("An error occurred.");
                ctrl.vm.data(null);
            });
        };
        ctrl.refreshSoon = function() {
            if(refreshTimer) return;
            refreshTimer = setTimeout(function() {
                ctrl.refresh();
            }, 20);
        };
    }


    return function(container, dataSourceUrl) {
        this.ctrl = m.module(container, {view: PicotableView, controller: PicotableController});
        this.ctrl.setSource(dataSourceUrl);
    };
}(window.m));
if (typeof module != "undefined" && module !== null && module.exports) module.exports = Picotable;
else if (typeof define === "function" && define.amd) define(function() {
    return Picotable;
});

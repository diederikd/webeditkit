var snabbdom = require('snabbdom/snabbdom');
var patch = snabbdom.init([ // Init patch function with chosen modules
    require('snabbdom/modules/class').default, // makes it easy to toggle classes
    require('snabbdom/modules/props').default, // for setting properties on DOM elements
    require('snabbdom/modules/style').default, // handles styling on elements with support for animations
    require('snabbdom/modules/eventlisteners').default, // attaches event listeners
]);
var h = require('snabbdom/h').default; // helper function for creating vnodes
const toVNode = require('snabbdom/tovnode').default;
const uiutils = require('./uiutils.js');
const datamodel = require('./datamodel.js');
const wscommunication = require('./wscommunication.js');
const autocomplete = require('autocompleter');

function triggerChangeOnPropertyNode(modelNode, propertyName, propertyValue) {
    console.log("triggerChangeOnPropertyNode", modelNode, propertyName, propertyValue);
    window.wscommunication.sendJSON({
        type: "propertyChange",
        nodeId: modelNode.idString(),
        modelName: modelNode.modelName(),
        propertyName: propertyName,
        propertyValue: propertyValue
    });
}

function editableCell(modelNode, propertyName, extraClasses, opts) {
    let placeholder = "<no " + propertyName+">";
    if (modelNode == undefined) {
        throw "modelNode should not be undefined";
    }
    extraClasses = extraClasses || [];
    extraClassesStr = "";
    if (extraClasses.length > 0) {
        extraClassesStr = "." + extraClasses.join(".");
    }
    return h("input.editable" + extraClassesStr, {
    props:{
        value: modelNode.property(propertyName),
        placeholder: placeholder,
        required: true
    },
    hook: { insert: addAutoresize, update: triggerResize },
    on: { keyup: function(e){
            triggerChangeOnPropertyNode(modelNode, propertyName, $(e.target).val());
        }
    }}, [])
}

function installAutocomplete(vnode, valuesProvider) {
    let input = vnode.elm;
    // $(input).keyup(function(){
    //     console.log("keyup autocomplete");
    //     let text = input.value.toLowerCase();
    //     console.log("VALUES " + valuesProvider(input));
    //     let matched = valuesProvider(input).filter(n => n.label.toLowerCase() == text);
    //     console.log("TEXT "+text+" MATCHED " + matched);
    //     if (matched.length == 1) {
    //         autocompleteTriggered(input, matched[0]);
    //     } else {
    //         $(input).attr("selected-id", null);
    //         //$(input).removeClass("selection-done");
    //     }
    // });
    autocomplete({
        input: input,
        minLength: 0,
        render: function(item, currentValue) {
            var div = document.createElement("div");
            div.className = "autocomplete-item";
            div.textContent = item.label;
            return div;
        },
        // renderGroup: function(groupName, currentValue) {
        //     var div = document.createElement("div");
        //     div.className = "autosuggest-group";
        //     div.textContent = groupName;
        //     return div;
        // },
        fetch: function (text, update) {
            text = text.toLowerCase();
            //var suggestions = ["A", "B", "C", "doo", "foo"];
            var suggestions = valuesProvider().filter(n => n.label.toLowerCase().startsWith(text));
            update(suggestions);
        },
        onSelect: function (item) {
            //autocompleteTriggered(input, item);
            item.execute();
        }
    });
}

function fixedCell(text, extraClasses, alternativesProvider) {
    extraClasses = extraClasses || [];
    extraClassesStr = "";
    if (extraClasses.length > 0) {
        extraClassesStr = "." + extraClasses.join(".");
    }
    return h("input.fixed" + extraClassesStr, {
        props: {value:text},
        hook: {
            insert: function(vnode){
                addAutoresize(vnode);
                if (alternativesProvider != null && alternativesProvider != undefined) {
                    installAutocomplete(vnode, alternativesProvider);
                }
            },
            update: triggerResize },
        }, []);
}

function row() {
    return h("div.row", {}, flattenArray(arguments));
}

function flattenArray(value) {
    return Array.from(value).flat();
}

function emptyRow() {
    return row();
}

function tabCell() {
    return h("div.tab", {}, []);
}

function map(originalArray, op) {
    return Array.from($(originalArray).map(op));
}

function registererRenderer(name, renderer) {
    if (window.renderers == undefined) {
        window.renderers = {};
    }
    window.renderers[name] = renderer;
}

function alternativesProvider() {
    return function() {
        return [
            {
                label: "boolean",
                execute: function () {
                    console.log("selected boolean");
                }
            },
            {
                label: "string",
                execute: function () {
                    console.log("selected string");
            }}];
    }
}

function getDefaultRenderer(name, abstractConcept) {
    return function (dataModel) {
        if (abstractConcept) {
            return fixedCell("", ['default-cell-abstract'], alternativesProvider(name));
        } else {
            return fixedCell("[default " + name + "]", ['default-cell-concrete']);
        }
    };
}

function getRenderer(name, abstractConcept) {
    if ((window.renderers == undefined) || !(name in window.renderers)){
        //throw "No renderer found for " + name;
        return getDefaultRenderer(name, abstractConcept);
    }
    return window.renderers[name];
}

registererRenderer("com.strumenta.financialcalc.Input", function(modelNode) {
    if (modelNode == undefined) {
        throw "modelNode should not be undefined in renderer";
    }
    return horizontalGroupCell(
        editableCell(modelNode, "name"),
        fixedCell("of type", ["keyword"]),
        childCell(modelNode, "type"));
});

registererRenderer("com.strumenta.financialcalc.StringType", function(modelNode) {
    return fixedCell("string", ["type"]);
});

// registererRenderer("com.strumenta.financialcalc.Type", function(modelNode) {
//     return fixedCell("<TYPE>", ["type"]);
// });

registererRenderer("com.strumenta.financialcalc.FinancialCalcSheet", function(modelNode) {
    return verticalGroupCell(
        row(
            fixedCell("Calculations", ["title"]),
            editableCell(modelNode, "name", ["title"])
        ),
        emptyRow(),
        row(
            fixedCell("inputs:", ["strong"])
        ),
        row(
            tabCell(),
            verticalCollectionCell(modelNode, 'inputs'))
    );
});

function renderModelNode(modelNode) {
    return getRenderer(modelNode.conceptName(), modelNode.isAbstract())(modelNode);
}

function childCell(modelNode, containmentName) {
    return renderModelNode(modelNode.childByLinkName(containmentName));
}

function verticalCollectionCell(modelNode, containmentName) {
    return h('div.vertical-collection', {},
        map(modelNode.childrenByLinkName(containmentName), function () {
            return row(renderModelNode(this));
        }));
}

function horizontalGroupCell() {
    return h('div.horizontal-group', {}, flattenArray(arguments));
}

function verticalGroupCell() {
    return h('div.vertical-group', {}, flattenArray(arguments));
}

/*
 It should be removed and implicit
 */
window.render_calc = function(modelNode) {
    return h('div#calc.editor', {}, [renderModelNode(modelNode)])
};

function addAutoresize(vnode) {
    $(vnode.elm).autoresize(myAutoresizeOptions);
}

function triggerResize(vnode) {
    $(vnode.elm).inputWidthUpdate(myAutoresizeOptions);
}

window.renderDataModels = function() {
    if (window.datamodel == undefined) {
        return;
    }

    let keys = Object.keys(window.datamodel);
    for (var i=0;i<keys.length;i++) {
        let key = keys[i];
        let renderFunctionName = "render_" + key;
        let renderFunction = window[renderFunctionName];
        let vnode = renderFunction(window.datamodel[key]);
        if (window.vnodes == undefined) {
            window.vnodes = {};
        }
        if (window.vnodes[key] == undefined) {
            window.vnodes[key] = toVNode($("div#"+key)[0]);
        }
        window.vnodes[key] = patch(window.vnodes[key], vnode);
    }
};

function loadDataModel(model, nodeId, target) {
    let nodeURL = "http://localhost:2904/models/" + model + "/" + nodeId;
    $.getJSON(nodeURL, function(data) {
        if (window.datamodel == undefined) {
            window.datamodel = {};
        }
        window.datamodel[target] = datamodel.dataToNode(data);
        window.datamodel[target].injectModelName(model);
        renderDataModels();
    });
}

$('document').ready(function(){
    uiutils.installAutoresize();
    window.wscommunication = new wscommunication.WsCommunication("com.strumenta.financialcalc.sandbox.company", "calc");
    loadDataModel("com.strumenta.financialcalc.sandbox.company", "324292001770075100", "calc");
});
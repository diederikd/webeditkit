const datamodel = require('./datamodel');

const renderers = require('./renderer');

var snabbdom = require('snabbdom/snabbdom');
var patch = snabbdom.init([ // Init patch function with chosen modules
    require('snabbdom/modules/class').default, // makes it easy to toggle classes
    require('snabbdom/modules/props').default, // for setting properties on DOM elements
    require('snabbdom/modules/style').default, // handles styling on elements with support for animations
    require('snabbdom/modules/eventlisteners').default, // attaches event listeners
    require('snabbdom/modules/dataset').default,
]);
var h = require('snabbdom/h').default; // helper function for creating vnodes
const toVNode = require('snabbdom/tovnode').default;

let vnodes = {};

let renderDataModels = function() {
    datamodel.forEachDataModel(function(name, root) {
        let vnode = h('div#' + name + '.editor', {}, [renderers.renderModelNode(root)]);
        if (vnodes[name] == undefined) {
            vnodes[name] = toVNode($("div#"+name)[0]);
        }
        vnodes[name] = patch(vnodes[name], vnode);
    });
};

function loadDataModel(baseUrl, model, nodeId, target) {
    let nodeURL = baseUrl + "/models/" + model + "/" + nodeId;
    $.getJSON(nodeURL, function(data) {
        let root = datamodel.dataToNode(data);
        root.injectModelName(model);
        datamodel.setDatamodelRoot(target, root);

        renderDataModels();
    });
}

module.exports.renderDataModels = renderDataModels;
module.exports.loadDataModel = loadDataModel;
module.exports.h = h;
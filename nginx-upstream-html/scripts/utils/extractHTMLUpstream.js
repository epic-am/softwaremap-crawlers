var htmlParser = require("htmlparser2");

var extractHTMLUpstream = function () {

};

extractHTMLUpstream.prototype._extractUpstreamFromBody = function (service, body, data) {
  var startToken = '<table';
  var endToken = '</table>';
  var start = body.indexOf(startToken);
  var end = body.indexOf(endToken) + endToken.length;
  var self = this;

  var handler = new htmlParser.DomHandler(function (err, dom) {
    if (err) {
      return err;
    }
    data = self.parseTable(service, dom);
  }, {
    normalizeWithSpace: true
  });
  var parser = new htmlParser.Parser(handler, { xmlMode: true });

  var table = body.substring(start, end);
  parser.parseComplete(table);
  return data;
};

extractHTMLUpstream.prototype.parseTable = function (service, dom) {
  var keys = [];
  var data = [];
  var table = dom[0];
  var self = this;

  self.children(table, function (tr, i) {
    if (i === 0) {
      self.children(tr, function (td) {
        keys.push(self.text(td));
      }, { name: 'th'});
    } else {
      var row = {};
      self.children(tr, function (td, i) {
        row[keys[i]] = self.text(td);
      }, { name: 'td'});
      data.push(row);
    }
  }, { name: 'tr'});
  return data;
};

extractHTMLUpstream.prototype.children = function(node, cb, options) {
  if (node.type !== 'tag')
    return;
  options = options || {};
  if (options.name)
    options.type = 'tag';
  var i = 0;
  for (var j in node.children) {
    var child = node.children[j];
    if (options.type && options.type !== child.type)
      continue;
    if (options.name && options.name !== child.name)
      continue;
    cb.call(child, child, i++);
  }
};

extractHTMLUpstream.prototype.text = function(node) {
  if (node.type === 'text')
    return node.data;
  else if (node.type === 'tag') {
    var txt = '';
    for (var i in node.children)
      txt += this.text(node.children[i]);
    return txt;
  }
  return '';
};

module.exports = extractHTMLUpstream;

// controllers/api.js

// local modules
const data = require("../data.js");
const helper = require("../helper.js");

// send server infos
exports.getServer = (req, res) => {
  console.log("API: Sending json server");
  res.json({
    version: `Node.js ${process.version}`,
    uptime: Math.floor(process.uptime()),
    pid: process.pid,
    arch: process.arch,
    clients: data.clients.length,
  });
};

// send config options
exports.getOptions = (req, res) => {
  console.log("API: Sending json file");
  res.json({
    converter: data.config.asciidoc.converter,
  });
};

// receive config options
exports.setOptions = (req, res) => {
  // get received data
  const newConverter = req.body.options.converter;

  // check the given newConverter
  if (helper.isValidConverter(newConverter)) {
    console.log(`API: Receiving valid converter '${newConverter}'`);
    data.config.asciidoc.converter = newConverter;
  } else {
    console.log(`API: Receiving invalid converter '${newConverter}'`);
    res.status(400);
    res.end();
  }

  res.status(204);
  res.end();
};

// send preview
exports.getPreview = (req, res) => {
  console.log("API: Sending json file");
  res.json({
    file: {
      path: data.preview.filepath,
      position: data.preview.position,
      line: data.preview.line,
    },
  });
};

// receive preview
exports.setPreview = (req, res) => {
  // get received data
  const newFilepath = req.body.preview.filepath;
  const newPosition = req.body.preview.position;
  const newLine = parseInt(req.body.preview.line) || 0;
  console.log("DEBUG: " + newFilepath + " - " + newPosition);

  // handle received file
  if (helper.isValidFile(newFilepath, data.config.asciidoc.extensions)) {
    console.log(`API: Receiving valid file '${newFilepath}'`);

    // set update or create state
    if (data.preview.filepath) {
      res.status(204); // No Content (200, 204)
    } else {
      res.status(201); // Created (201)
    }

    // set only if it is a new file, position or line
    const fileChanged = newFilepath != data.preview.filepath;
    const positionChanged = newPosition != data.preview.position;
    const lineChanged = newLine != data.preview.line;
    data.preview.filepath = newFilepath;
    data.preview.position = newPosition;
    data.preview.line = newLine;
    if (fileChanged || (positionChanged && !newLine)) {
      exports.notifyClientsToUpdate();
    } else if (lineChanged) {
      // same page, only scroll (no reload)
      exports.notifyClientsToScroll();
    }

    //res.send('Valid file')
    res.end();
  } else {
    console.log(`API: Receiving not valid file '${newFilepath}'`);
    res.status(400); // Bad Request
    //res.send('No valid file')
    res.end();
  }
};

// send hi message
exports.hi = (req, res) => {
  res.status(200);
  res.json({
    hi: "Coffee please",
  });
};

// receive action: subscribe client
exports.subscribe = (req, res) => {
  console.log("API: Receiving subscription");

  // send header keep alive
  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };
  res.writeHead(200, headers);

  // store client response
  const clientId = Date.now();
  const newClient = { id: clientId, response: res };
  data.clients.push(newClient);
  res.write("you are subscribed\n");
  console.log(`Server: Client '${clientId}' registered`);

  // listen for client 'close' requests
  req.on("close", () => {
    console.log(`Server: Client '${clientId}' connection closed`);
    data.clients = data.clients.filter((client) => client.id !== clientId);
  });
};

// receive action: notify clients
exports.notify = (req, res) => {
  exports.notifyClientsToUpdate();
  res.status(204); // No Content
  res.end();
};

// receive action: stop server
exports.stop = (req, res) => {
  console.log("API: Receiving server stop");
  exports.notifyClientsToClose();
  res.status(204); // No Content
  res.end();
  helper.waitToClose(data.server);
};

// send update notify to all clients (`<position>` or `<position>;<line>`)
exports.notifyClientsToUpdate = () => {
  console.log("Server: Notify all clients to update");
  const line = data.preview.line ? `;${data.preview.line}` : "";
  data.clients.forEach((client) =>
    client.response.write(`data: ${data.preview.position}${line}\n\n`),
  );
};

// send scroll notify to all clients (`line:<line>`), no reload
exports.notifyClientsToScroll = () => {
  data.clients.forEach((client) =>
    client.response.write(`data: line:${data.preview.line}\n\n`),
  );
};

// send close notify to all clients
exports.notifyClientsToClose = () => {
  data.preview.isFinished = true;

  // remove build cache (only for local asciidoctor command)
  if (data.config.asciidoc.converter == "cmd") {
    const childProcess = require("child_process");
    childProcess.execSync("rm -rf " + data.config.cachedir);
  }

  console.log("Server: Notify all clients to close");
  data.clients.forEach((client) => client.response.end("data: close\n\n"));
};

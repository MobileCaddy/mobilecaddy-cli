// utils.js

const read = require('read'),
  fs = require('fs'),
  base64 = require('base-64');

var colors = require('colors');
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

const mcBuildLog = 'mc-build.log';
let jsforce = require('jsforce');

function _arrayBufferToBase64(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64.encode(binary);
}

function compareVersions(v1, v2, options) {
  var lexicographical = options && options.lexicographical,
    zeroExtend = options && options.zeroExtend,
    v1parts = v1.split('.'),
    v2parts = v2.split('.');

  function isValidPart(x) {
    return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
  }

  if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
    return NaN;
  }

  if (zeroExtend) {
    while (v1parts.length < v2parts.length) v1parts.push('0');
    while (v2parts.length < v1parts.length) v2parts.push('0');
  }

  if (!lexicographical) {
    v1parts = v1parts.map(Number);
    v2parts = v2parts.map(Number);
  }

  for (var i = 0; i < v1parts.length; ++i) {
    if (v2parts.length == i) {
      return 1;
    }

    if (v1parts[i] == v2parts[i]) {
      continue;
    } else if (v1parts[i] > v2parts[i]) {
      return 1;
    } else {
      return -1;
    }
  }

  if (v1parts.length != v2parts.length) {
    return -1;
  }

  return 0;
}

/**
 * Replaces name placeholders throughout new project
 * @param  {string} appName
 * @return {promise}
 */
function replaceHtmlTitles(appName) {
  return new Promise(function(resolve, reject) {
    console.log('...');
    const replace = require('replace-in-file');
    let options = {
      files: ['src/index.html', 'apex-templates/startpage-template.apex'],
      from: /\<title\>.*\<\/title\>/g,
      to: '<title>' + appName + '</title>'
    };
    replace(options)
      .then(function(result) {
        resolve();
        // index.html
      })
      .catch(function(e) {
        console.log('Error replacing placeholders: '.error + JSON.stringify(e));
        reject(e);
      });
  });
}

function runShellTask(str, mirrorOutput) {
  return new Promise((resolve, reject) => {
    mirrorOutput = mirrorOutput != false ? true : false;
    // console.log("runShellTask", str);
    var child = exec(str, { async: true });

    child.stdout.on('data', data => {
      if (mirrorOutput) console.log(data);
      // this.writeToLog(mcBuildLog,  data);
      inRcvd = true;
    });

    child.stderr.on('data', data => {
      console.log('\n: ' + data);
      this.writeToLog(mcBuildLog, 'ERROR: ' + data);
      inRcvd = true;
    });

    child.on('close', code => {
      complete = true;
      if (code !== 0) {
        console.log('Boo! process exited with code ' + code);
        this.writeToLog(mcBuildLog, 'Boo! process exited with code ' + code);
        reject(code);
      } else {
        // console.log('YAY! process exited OK.');
        this.writeToLog(mcBuildLog, 'YAY! process exited OK.');
        resolve();
      }
    });
  });
}

/**
 * Sets up a jsforce connection and logs in.
 * @param  {object} options Command line options.
 *
 * TODO: Call running app to get instance and accessToken
 */
async function setupOrgConn(options) {
  return new Promise(function(resolve, reject) {
    let endpoint = options.endpoint ? options.endpoint : 'login.salesforce.com';

    if (endpoint.startsWith('https://')) endpoint = endpoint.slice(8);
    var conn = new jsforce.Connection({
      loginUrl: 'https://' + endpoint
    });

    if (options.username) {
      // username / password login
      readPassword()
        .then(function(password) {
          console.log('Thanks for password');
          conn.login(options.username, password, function(err, userInfo) {
            // console.log("userInfo", userInfo);
            if (err) {
              console.error(err.message);
              if (options.verbose) console.error(err.stack);
              process.exit(0);
              reject();
            }
            resolve(conn);
          });
        })
        .catch(function(e) {
          console.error(e);
        });
    } else {
      console.log('Supply a username, using -u option'.error);
      process.exit(0);
    }
  });
}

function writeToLog(filename, msg) {
  var myDate = new Date().toLocaleString();
  fs.appendFileSync(filename, '\n' + myDate + ' : ' + msg);
}

// P R I V A T E    F U N C T I O N S

async function readPassword() {
  return new Promise(function(resolve, reject) {
    read({ prompt: 'Password: ', silent: true, replace: '*' }, function(
      er,
      password
    ) {
      resolve(password);
    });
  });
}

module.exports = {
  _arrayBufferToBase64: _arrayBufferToBase64,
  compareVersions: compareVersions,
  replaceHtmlTitles: replaceHtmlTitles,
  runShellTask: runShellTask,
  setupOrgConn: setupOrgConn,
  writeToLog: writeToLog
};

/**
 * deploy.js
 */

// S E T U P

const fs = require('fs'),
  utils = require('./utils.js'),
  path = require('path');

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
const startPageControllerVersion = '001';
let jsforce = require('jsforce');
const apiVersionInt = 41;

// let conn;

try {
  packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch (err) {
  // do nothing
}

// P U B L I C    F U N C T I O N S

/**
 * Checks versions and compatibility of various things (MobileCaddy package/MC_Resource, etc)
 */
function checkVersions(conn) {
  return new Promise(function(resolve, reject) {
    // Get node_module versions
    var dirs = fs.readdirSync('node_modules');
    var data = {};
    dirs.forEach(function(dir) {
      try {
        var file = 'node_modules/' + dir + '/package.json';
        file = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(file);
        const name = json.name;
        const version = json.version;
        data[name] = version;
      } catch (err) {}
    });
    deviceAppName = getDeviceAppName();

    var options = JSON.stringify({
      function: 'versionInfo',
      mc_utils_resource: packageJson.mc_utils_resource,
      sf_mobile_application: packageJson.sf_mobile_application,
      targeted_dv: packageJson.sf_app_vsn,
      mobilecaddy_codeflow_vsn: data['mobilecaddy-codeflow'],
      mobilecaddy_codeflow_utils_vsn: data['mobilecaddy-utils'],
      // mobilecaddy_cli_vsn: '1.2',
      device_app_name: deviceAppName
    });
    // console.log('options', options);

    conn.apex.post(
      '/mobilecaddy1/PlatformDevUtilsR001/',
      {
        startPageControllerVersion: startPageControllerVersion,
        jsonParams: options
      },
      function(err, res) {
        if (err) {
          return console.error(err);
        } else {
          const respJson = JSON.parse(res);
          console.log('versionInfo result:', res, respJson);
          if (
            utils.compareVersions(
              respJson.packageVersion,
              packageJson.min_mobilecaddy_version
            ) >= 0
          ) {
            resolve();
          } else {
            console.log(
              'Version of MobileCaddy on SFDC needs to be min version '.error +
                packageJson.min_mobilecaddy_version +
                '.\nCurrently running '.error +
                respJson.packageVersion +
                '.\nPlease upgrade.'.error
            );
            reject();
          }
        }
      }
    );
  });
}

function prepDeployAssets(deployOptions) {
  return new Promise(function(resolve, reject) {
    const appVsnSfx = packageJson.version.replace(/\./g, '');
    let bundleName = packageJson.name + '_' + appVsnSfx + '.zip';
    let mcTmpDir = 'mc-tmp';
    utils
      .replaceHtmlTitles(packageJson.name)
      .then(function() {
        // Create tmp dir if needed
        if (!fs.existsSync(mcTmpDir)) {
          return Promise.resolve();
        } else {
          return utils.runShellTask('rm -r ' + mcTmpDir);
        }
      })
      .then(function(result) {
        fs.mkdirSync(mcTmpDir);
        console.log('Building project...');
        let ionicbuildFlag = deployOptions.prod ? ' --prod --release ' : '';
        return utils.runShellTask(
          'ionic build ' +
            ionicbuildFlag +
            ' && cp -r www/* ' +
            mcTmpDir +
            '/ && rm -r ' +
            mcTmpDir +
            '/assets/js/',
          false
        );
      })
      .then(function(result) {
        console.log('Cleaning temp files...');
        if (fs.existsSync(mcTmpDir + '/mock')) {
          return utils.runShellTask('rm -r ' + mcTmpDir + '/mock');
        } else {
          return Promise.resolve();
        }
      })
      .then(r => {
        console.log('Renaming font files to work-around Saleforce oddness...');
        return uppercaseFontFiles(mcTmpDir + '/assets/fonts');
      })
      .then(r => {
        console.log('Renaming font refs to work-around Saleforce oddness...');
        return uppercaseFontRefsinCSS(deployOptions);
      })
      .then(r => {
        if (fs.existsSync(bundleName)) {
          return utils.runShellTask('rm ' + bundleName);
        } else {
          return Promise.resolve();
        }
      })
      .then(r => {
        // bundle the zip
        console.log('Creating bundle...');
        const zipdir = require('zip-dir');
        zipdir(
          mcTmpDir,
          { saveTo: bundleName },
          function(err, buffer) {
            // `buffer` is the buffer of the zipped file
            // And the buffer was saved to bundleName
            createApexTemplates(mcTmpDir + '/build')
              .then(function(result) {
                resolve();
              })
              .catch(function(e) {
                console.log('error: '.error + e);
                reject(e);
              });
          },
          function(e) {
            console.log(e);
            reject(e);
          }
        );
      })
      .catch(function(e) {
        console.log('error: '.error + e.error);
        reject();
      });
  });
}

function deploy(conn) {
  return new Promise((resolve, reject) => {
    // conn = conn;
    checkPlatformVsn(conn)
      .then(r => {
        return uploadAppBundle(conn);
      })
      .then(r => {
        return uploadCachePage(conn);
      })
      .then(r => {
        return uploadStartPage(conn);
      })
      .then(r => {
        console.log('D E P L O Y    C O M P L E T E'.info);
      })
      .catch(e => {
        reject(e);
      });
  });
}

// P R I V A T E    F U N C T I O N S

function checkPlatformVsn(conn) {
  return new Promise((resolve, reject) => {
    var options = JSON.stringify({
      function: 'versionInfo'
      // TODO RE ADD ALL THIS STUFF
      // mc_utils_resource: appConfig.mc_utils_resource,
      // sf_mobile_application: appConfig.sf_mobile_application,
      // targeted_dv: appConfig.sf_app_vsn,
      // mobilecaddy_codeflow_vsn: codeFlowVersion,
      // mobilecaddy_codeflow_utils_vsn: codeFlowUtilsVersion,
      // // mobilecaddy_cli_vsn: '1.2',
      // deploy_service_vsn: deployServiceVsn,
      // device_app_name: deviceAppName
    });

    conn.apex.post(
      '/mobilecaddy1/PlatformDevUtilsR001/',
      {
        startPageControllerVersion: startPageControllerVersion,
        jsonParams: options
      },
      function(err, res) {
        if (err) {
          return console.error(err);
        }
        // console.log('response: ', res);
        resolve();
        // the response object structure depends on the definition of apex class
      }
    );
  });
}

function createApexTemplates(buildDir) {
  return new Promise(function(resolve, reject) {
    const replace = require('replace-in-file');
    let mcTmpDir = 'mc-tmp';
    const appVsnSfx = packageJson.version.replace(/\./g, '');
    const myAppResource = packageJson.name + '_' + appVsnSfx;
    const myCacheResource = packageJson.name + 'Cache_' + appVsnSfx;
    let jsFiles;
    let jsFilesStartPageStr = '';
    let jsFilesCachePageStr = '';
    // Create tmp cache and startpages
    utils
      .runShellTask(
        'cp apex-templates/startpage-template.apex ' +
          mcTmpDir +
          '/' +
          myAppResource +
          '.apex'
      )
      .then(function(result) {
        return utils.runShellTask(
          'cp apex-templates/cachepage-template.apex ' +
            mcTmpDir +
            '/' +
            myCacheResource +
            '.apex'
        );
      })
      .then(function(result) {
        // Update placeholders in temp start/cache pages
        let options = {
          files: mcTmpDir + '/*.apex',
          from: /\<MY\_APP\_RESOURCE\>/g,
          to: myAppResource
        };
        return replace(options);
      })
      .then(function(result) {
        let options = {
          files: mcTmpDir + '/*.apex',
          from: /\<MY\_CACHE\_RESOURCE\>/g,
          to: myCacheResource
        };
        return replace(options);
      })
      .then(function(result) {
        var dirs = fs.readdirSync('node_modules');
        var data = {};
        dirs.forEach(function(dir) {
          try {
            var file = 'node_modules/' + dir + '/package.json';
            file = fs.readFileSync(file, 'utf8');
            var json = JSON.parse(file);
            var name = json.name;
            var version = json.version;
            data[name] = version;
          } catch (err) {}
        });

        let mobilecaddyAngularVsn = data['mobilecaddy-angular'];
        let mobilecaddyUtilsVsn = data['mobilecaddy-utils'];
        let ionicVsn = data['ionic-angular'];

        let options = {
          files: mcTmpDir + '/*.apex',
          from: /\<!-- MOBILECADDY-VSN-INFO --\>/g,
          to:
            '<!--\n  // mobilecaddy-angular v' +
            mobilecaddyAngularVsn +
            '\n  // mobilecaddy-utils v' +
            mobilecaddyUtilsVsn +
            '\n  // ionic v' +
            ionicVsn +
            '\n-->'
        };
        return replace(options);
      })
      .then(function(result) {
        // Add enttries for all required JS files
        jsFiles = fs
          .readdirSync(buildDir)
          .filter(
            item =>
              fs.statSync(path.join(buildDir, item)).isFile() &&
              path.extname(item) === '.js' &&
              item != 'sw-toolbox.js' &&
              item != 'polyfills.js' &&
              item != 'vendor.js' &&
              item != 'main.js'
          );
        jsFiles.forEach(fileName => {
          jsFilesStartPageStr +=
            '\n    <script src="{!URLFOR($Resource.' +
            myAppResource +
            ", 'build/" +
            fileName +
            '\')}"></script>';
          jsFilesCachePageStr +=
            '\n{!URLFOR($Resource.' +
            myAppResource +
            ", 'build/" +
            fileName +
            "')}";
        });
        let options = {
          files: mcTmpDir + '/' + myAppResource + '.apex',
          from: /\<\!-- BUILD-SCRIPTS-DO-NOT-REMOVE --\>/g,
          to: jsFilesStartPageStr
        };
        return replace(options);
      })
      .then(function(result) {
        let options = {
          files: mcTmpDir + '/' + myCacheResource + '.apex',
          from: /\<\!-- BUILD-SCRIPTS-DO-NOT-REMOVE --\>/g,
          to: jsFilesCachePageStr
        };
        return replace(options);
      })
      .then(function(result) {
        resolve();
      })
      .catch(function(e) {
        console.log(e);
        reject(e);
      });
  });
}

/**
 * Does the static resource already exist on the platform for this app/vsn
 */
function doesBundleExist(conn) {
  return new Promise((resolve, reject) => {
    var dataName = packageJson.sf_app_name + '_' + packageJson.sf_app_vsn;
    console.log('Checking for existing app bundle ' + dataName);
    conn.tooling
      .sobject('StaticResource')
      .find({ Name: dataName })
      .execute(function(err, records) {
        if (err) {
          console.log(
            'Failed to check if app bundle already existed on platform'.error
          );
          reject(err);
        }
        // console.debug('fetched : ' + records.length);
        if (records.length > 0) {
          let record = records[0];
          // console.debug('Id: ' + record.Id);
          // console.debug('Name: ' + record.Name);
          resolve(record);
        } else {
          resolve(false);
        }
      });
  });
}

function encodeAppBundle() {
  return new Promise(function(resolve, reject) {
    var JSZip = require('jszip');
    let myBundleZipName =
      packageJson.name + '_' + packageJson.sf_app_vsn + '.zip';
    console.log('Encodeing bundle ' + myBundleZipName);
    fs.readFile(myBundleZipName, function(err, data) {
      if (err) throw err;
      // JSZip.loadAsync(data).then(function(zip) {
      let encodedApp = utils._arrayBufferToBase64(data);
      // console.log('Got our encoded bundle');
      resolve(encodedApp);
    });
  });
}

function getDeviceAppName() {
  var details = {};
  const cachePageContents = fs.readFileSync('src/index.html', 'utf8');
  var lines = cachePageContents.split('\n');
  var buildName = '';
  lines.forEach(function(line, i) {
    if (line.includes('window.DEVICE_APP_NAME')) {
      buildName = line.split('=')[1].replace(/\W/g, '');
    }
  });
  return buildName;
}

function uploadAppBundle(conn, myBody) {
  return new Promise((resolve, reject) => {
    var dataName = packageJson.sf_app_name + '_' + packageJson.sf_app_vsn;
    let myZipData;
    encodeAppBundle()
      .then(zipdata => {
        myZipData = zipdata;
        return doesBundleExist(conn);
      })
      .then(existingBundle => {
        if (existingBundle) {
          // Update existing resource
          console.debug('App bundle already exists... patching existing');
          conn.tooling.sobject('StaticResource').update(
            {
              body: myZipData,
              ContentType: 'application/zip',
              CacheControl: 'Public',
              Id: existingBundle.Id
            },
            function(err, res) {
              if (err) {
                console.error(err);
                reject();
              }
              console.log('Patched existing app bundle'.info);
              resolve();
            }
          );
        } else {
          // Updload new resource
          conn.tooling.sobject('StaticResource').create(
            {
              Name: dataName,
              Description:
                'App Bundle - auto-uploaded by MobileCaddy delopyment tooling',
              body: myZipData,
              ContentType: 'application/zip',
              CacheControl: 'Public'
            },
            function(err, res) {
              if (err) {
                console.error(err);
                reject();
              }
              console.log('Deployed app bundle'.info);
              resolve();
            }
          );
        }
      });
  });
}

function uploadCachePage(conn) {
  return new Promise((resolve, reject) => {
    var dataName = packageJson.sf_app_name + 'Cache_' + packageJson.sf_app_vsn;
    const cachePageContents = fs.readFileSync(
      'mc-tmp/' + dataName + '.apex',
      'utf8'
    );
    // console.log('cachePageContents', cachePageContents);
    const pageOptions = JSON.stringify({
      function: 'createApexPage',
      pageApiName: dataName,
      pageLabel: dataName,
      pageContents: cachePageContents,
      apiVersion: apiVersionInt,
      pageDescription: 'MobileCaddy CachePage'
    });
    // console.log('pageOptions', pageOptions);
    conn.apex.post(
      '/mobilecaddy1/PlatformDevUtilsR001/',
      {
        startPageControllerVersion: startPageControllerVersion,
        jsonParams: pageOptions
      },
      function(err, res) {
        if (err) {
          return console.error(err);
        } else {
          console.log('Deployed cache page'.info);
        }
        resolve();
        // the response object structure depends on the definition of apex class
      }
    );
  });
}

function uploadStartPage(conn) {
  return new Promise((resolve, reject) => {
    var dataName = packageJson.sf_app_name + '_' + packageJson.sf_app_vsn;
    const startPageContents = fs.readFileSync(
      'mc-tmp/' + dataName + '.apex',
      'utf8'
    );
    // console.log('startPageContents', startPageContents);
    const pageOptions = JSON.stringify({
      function: 'createApexPage',
      pageApiName: dataName,
      pageLabel: dataName,
      pageContents: startPageContents,
      apiVersion: apiVersionInt,
      pageDescription: 'MobileCaddy StartPage'
    });
    // console.log('pageOptions', pageOptions);
    conn.apex.post(
      '/mobilecaddy1/PlatformDevUtilsR001/',
      {
        startPageControllerVersion: startPageControllerVersion,
        jsonParams: pageOptions
      },
      function(err, res) {
        if (err) {
          return console.error(err);
        } else {
          console.log('Deployed start page'.info);
        }
        resolve();
        // the response object structure depends on the definition of apex class
      }
    );
  });
}

function uppercaseFontFiles(fontDir) {
  return new Promise(function(resolve, reject) {
    fs.readdir(fontDir, (err, files) => {
      files.forEach(file => {
        // console.log(file);
        let fSplit = file.split('.');
        if (['woff', 'woff2', 'ttf', 'eot', 'svg'].includes(fSplit[1])) {
          let newFileName = fSplit[0] + '.' + fSplit[1].toUpperCase();
          fs.renameSync(fontDir + '/' + file, fontDir + '/' + newFileName);
        }
      });
      resolve();
    });
  });
}

function uppercaseFontRefsinCSS(deployOptions) {
  return new Promise(function(resolve, reject) {
    const replace = require('replace-in-file');
    const cssFromPatt = deployOptions.prod
      ? [/\.woff/g, /\.ttf/g, /\?v=\S*\)/g]
      : [/\.woff/g, /\.ttf/g, /\?v=.*\"/g];
    const cssToPatt = deployOptions.prod
      ? ['.WOFF', '.TTF', ')']
      : ['.WOFF', '.TTF', '"'];
    let options = {
      files: 'mc-tmp/build/*.css*',
      from: cssFromPatt,
      to: cssToPatt
    };
    replace(options)
      .then(function(result) {
        let options = {
          files: 'mc-tmp/assets/fonts/*.scss',
          from: [/\.woff/g, /\.ttf/g, /\?v=#{\$ionicons-version}/g],
          to: ['.WOFF', '.TTF', '']
        };
        return replace(options);
      })
      .then(function(result) {
        resolve();
      })
      .catch(function(e) {
        reject(e);
      });
  });
}

module.exports = {
  checkVersions: checkVersions,
  deploy: deploy,
  prepDeployAssets: prepDeployAssets
};

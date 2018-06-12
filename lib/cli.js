#!/usr/bin/env node

/*
===========================================================================
  S E T T I N G    S T U F F    U P
===========================================================================
*/

var args = [];

process.argv.slice(2).forEach(function(arg) {
  var flag = arg.split('=')[0];

  switch (flag) {
    case 'debug':
      args.push('--nodeDebug');
      args.push('true');
      break;
    case '-d':
    case '--debug':
    case '--debug-brk':
      args.push('--v8Debug');
      args.push('true');
      break;
    default:
      args.push(arg);
      break;
  }
});

var fs = require('fs'),
  read = require('read'),
  fse = require('fs-extra'),
  path = require('path'),
  os = require('os'),
  unzip = require('unzip'),
  Q = require('q'),
  request = require('request'),
  Download = require('download'),
  shelljs = require('shelljs/global'),
  _ = require('underscore'),
  commandLineArgs = require('command-line-args'),
  Store = require('jfs'),
  mcDataDir = os.homedir() + '/.mobilecaddy/',
  packageJson = {},
  db = new Store(mcDataDir + 'mc-apps.json', { type: 'single', pretty: true }),
  jsforce = require('jsforce');

const utils = require('./utils.js');

/* Handle command line args & flags */
const mainDefinitions = [{ name: 'command', defaultOption: true }];
const mainOptions = commandLineArgs(mainDefinitions, {
  stopAtFirstUnknown: true
});
var argv = mainOptions._unknown || [];
var monitorOptions,
  deployOptions,
  serveOptions = {};
switch (mainOptions.command) {
  case 'monitor':
    const monitorDefinitions = [
      { name: 'username', alias: 'u', type: String },
      { name: 'verbose', type: Boolean },
      { name: 'endpoint', alias: 'e', type: String }
    ];
    monitorOptions = commandLineArgs(monitorDefinitions, { argv });
    break;
  case 'serve':
    const serveDefinitions = [
      { name: 'monitor', alias: 'm', type: Boolean },
      { name: 'username', alias: 'u', type: String },
      { name: 'rec', alias: 'r', type: Boolean },
      { name: 'scrub', alias: 's', type: String },
      { name: 'local', alias: 'l', type: Boolean },
      { name: 'verbose', type: Boolean }
    ];
    serveOptions = commandLineArgs(serveDefinitions, { argv });
    break;
  case 'deploy':
    const deployDefinitions = [
      { name: 'prod', alias: 'p', type: Boolean },
      { name: 'username', alias: 'u', type: String },
      { name: 'verbose', type: Boolean },
      { name: 'endpoint', alias: 'e', type: String }
    ];
    deployOptions = commandLineArgs(deployDefinitions, { argv });
    break;
}

/*
---------------------------------------------------------------------------
  S E T T I N G    S T U F F    U P
---------------------------------------------------------------------------
*/
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

const knownTemplates2 = [
  {
    id: 'ionic-shell',
    repo: 'http://github.com/MobileCaddy/shell-ionic/archive/master.zip',
    name: 'mobilecaddy-shell-ionic',
    desc: 'Empty Ioinc skeleton project'
  },
  {
    id: 'ionic-seed-expenses',
    repo:
      'https://github.com/MobileCaddy/seed-expenses-ionic/archive/master.zip',
    name: 'mobilecaddy-seed-expenses-ionic',
    desc: 'Ionic Time & Expenses App'
  }
];

const mcBuildLog = 'mc-build.log';

try {
  packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch (err) {
  // do nothing
}

/*
---------------------------------------------------------------------------
  H E L P
---------------------------------------------------------------------------
*/

// TODO use minimist instead
var optimist = require('optimist')
  .usage(
    'Usage: \n' +
      'mobilecaddy new <template|git-zip-url> <your-app-name> <optional-path> [--sudo]\n' +
      'mobilecaddy serve [options]\n' +
      'mobilecaddy templates\n' +
      'mobilecaddy monitor --username <USERNAME> [--endpoint <LOGIN_URL>]\n' +
      'mobilecaddy deploy --username <USERNAME> [--endpoint <LOGIN_URL>  --prod]'
  )
  .describe('help', 'Print MobileCaddy help menu')
  .describe('version', 'Print MobileCaddy version')
  .describe('sudo', "Run 'new' command as root")
  .describe('local', "Run 'serve' against local mock data rather than SFDC")
  .describe(
    'endpoint',
    "Set 'monitor' or 'deploy' to login with a specific login URL. Default: 'https://login.salesforce.com'"
  )
  .describe(
    'rec',
    "Record SFDC responses during a 'serve' and populate 'mock' files"
  )
  .describe(
    'scrub=[true|false]',
    "Clears local data ('full'=inc oauth) upon 'serve'"
  )
  .describe('username', 'SFDC username')
  .describe('verbose', 'verbose output');

argv = optimist.parse(args);

if (argv.help || argv.h) {
  optimist.showHelp();
  maybeShowNodeWarning();
  process.exit(0);
}

if (argv.version || argv.v) {
  console.log(
    'mobilecaddy-cli : ' +
      require(path.join(__dirname, '../package.json')).version
  );
  console.log(
    'Current project (' + packageJson.name + ') : ' + packageJson.version
  );

  maybeShowNodeWarning();

  process.exit(0);
}

if (argv._.length === 0) {
  optimist.showHelp();
  maybeShowNodeWarning();
  process.exit(0);
}

/*
===========================================================================
  C H O O S I N G    T H E    C O M M A N D
===========================================================================
*/
switch (args[0]) {
  case 'creds':
    runGetCreds();
    break;
  case 'deploy':
    runDeploy();
    break;
  case 'info':
    runAppInfo();
    break;
  case 'list':
    runAppList();
    break;
  case 'logo':
    runLogo();
    break;
  case 'monitor':
    runMonitor(monitorOptions);
    break;
  case 'new':
    runNew();
    break;
  case 'serve':
    runServe();
    break;
  case 'store-creds':
    runStoreCreds();
    break;
  case 'templates':
    runTemplates();
    break;
  case 'desktop-build':
    runDesktopBuild();
    break;
  case 'desktop-msi':
    runDesktopMSIBuild();
    break;
  default:
    runUnknownTask();
}

/**
 * @function runLogo
 */
function runLogo() {
  console.log('                .:/ccccccccccc/:-.'.info);
  console.log('              -ccmmmmmmmmmmccccccccccc:.'.info);
  console.log('         -cmmmmmmmmmmmmmmmmcccccccccccc:.'.info);
  console.log('       :cmmmmmmmmmmmmmmmccccccccccccccccc/-'.info);
  console.log('     -cmmmmmmmmmmmmmm/.      ./cccccccccccc/.'.info);
  console.log('    cmmmmmmmmmmmmmm:            ccccccccccccc:'.info);
  console.log('   cmmmmmmmmmmmmmc     ./cc/     cmccccccccccc/'.info);
  console.log('  cmmmmmmmmmmmmc-     cmmmmmc    -...:cccccccccc'.info);
  console.log(' cmmmmmmmmmmmm/     :mmmmmmm.           /ccccccc/'.info);
  console.log('.mmmmmmmmmmmc.    .cmmmmmmc      -:-     -ccccccc.'.info);
  console.log('cmmmmmmmmmmc     /mmmmmmc:     /mmmmm     ccccccc/'.info);
  console.log('cmmmmmmmmmmc   :cmmmmmmc     :cmmmmmc     mmmccccc'.info);
  console.log('mmmmmmmmmmmmmmmmmmmmmc-     cmmmmmmc.    cmmmmmccc'.info);
  console.log('cmmmmmmmmmmmmmmmmmmm/     :mmmmmmm:     cmmmmmmmmc'.info);
  console.log('cmmmmmmmmmmmmmmmmmc.    .cmmmmmmc     -cmmmmmmmmmc'.info);
  console.log('.mmmmmmmmmmmmmmmm/     /mmmmmmc-     cmmmmmmmmmmm-'.info);
  console.log(' cmmmmmmmmmmmmmmm-   -cmmmmmmc     :cmmmmmmmmmmmc'.info);
  console.log('  cmmmmmmmmmmmmmmmcccmmmmmmc.    .cmmmmmmmmmmmmc'.info);
  console.log('   cmmmmmmmmmmmmmmmmmmmmmm/     /mmmmmmmmmmmmmc'.info);
  console.log('    cmmmmmmmmmmmmmmmmmmmc     .cmmmmmmmmmmmmmc'.info);
  console.log('     -cmmmmmmmmmmmmmmmc-     cmmmmmmmmmmmmmc-'.info);
  console.log('       :cmmmmmmmmmmmmc     -cmmmmmmmmmmmmc:'.info);
  console.log('         -ccmmmmmmmc-     cmmmmmmmmmmmmc-'.info);
  console.log('            -/cmmm/     :cmmmmmmmmmc/-'.info);
  console.log('                ..    .cmmmcccc/:.'.info);
  process.exit(0);
}

/**
 * @function runGetCreds
 */
function runGetCreds() {
  if (args[1]) {
    let appName = args[1];
    objs = db.allSync();
    let instanceUrl;
    objs.apps.forEach(function(app) {
      if (app.name == appName && app.orgs) {
        instanceUrl = app.orgs[0];
      }
    });
    if (instanceUrl) {
      if (objs['creds-' + instanceUrl]) {
        console.log(JSON.stringify(objs['creds-' + instanceUrl]));
      } else {
        if (args[args.length - 1] == '--json') {
          console.log('{}');
        } else {
          console.log('No creds found'.info);
        }
      }
    } else {
      if (args[args.length - 1] == '--json') {
        console.log('{}');
      } else {
        console.log('No creds found '.info + appName);
      }
    }
  } else {
    if (args[args.length - 1] == '--json') {
      console.log('{}');
    } else {
      console.log('No app name supplied'.info);
    }
  }
  process.exit(0);
}

/**
 * @function runAppList
 */
function runAppList() {
  objs = db.allSync();
  if (objs.apps) {
    if (args[args.length - 1] == '--json') {
      console.log(JSON.stringify(objs.apps));
    } else {
      console.log(' Apps\n = = = = = = = = = ='.info);
      objs.apps.forEach(function(app) {
        console.log(' * ' + app.name.data + '');
      });
    }
  } else {
    if (args[args.length - 1] == '--json') {
      console.log('{}');
    } else {
      console.log('No Apps currently saved'.info);
    }
  }
  process.exit(0);
}

/**
 * @function runAppInfo
 */
function runAppInfo() {
  var appName;
  if (args[1]) {
    appName = args[1];
  } else {
    appName = appNameFromCurDir();
  }

  if (appName) {
    objs = db.allSync();
    if (objs.apps) {
      var app = _.find(objs.apps, function(el) {
        return el.name == appName;
      });
      if (app) {
        console.log(' App Info\n = = = = = = = = = ='.info);
        Object.keys(app).forEach(function(key) {
          console.log(' ' + key.toLocaleUpperCase() + ': ' + app[key]);
        });
      } else {
        console.log('Error: No info for app names '.error + appName.data);
      }
    } else {
      console.log('Error: No Apps currently saved'.info);
    }
  } else {
    console.log('Error: No App defined or found in current directory'.error);
  }
  process.exit(0);
}

function appNameFromCurDir() {
  try {
    json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return json.name;
  } catch (err) {
    return null;
  }
}

/**
 * @function runStoreCreds
 */
function runStoreCreds() {
  if (args[1] && args[2]) {
    var appName = args[1];
    var creds = JSON.parse(args[2]);

    objs = db.allSync();
    if (objs.apps) {
      objs.apps.forEach(function(app) {
        if (app.name == appName) {
          if (args[args.length - 1] == '--json') {
            console.log('Found App');
          } else {
            console.log('Found App '.info + appName.data);
          }
          if (app.orgs) {
            if (!app.orgs.includes(creds.instance_url))
              app.orgs.push(creds.instance_url);
          } else {
            app.orgs = [creds.instance_url];
          }
        }
      });
      db.saveSync('apps', objs.apps);
      db.saveSync('creds-' + creds.instance_url, {
        access_token: creds.access_token,
        refresh_token: creds.refresh_token,
        id: creds.id,
        instance_url: creds.instance_url
      });
    } else {
      console.log('Error: No Apps currently saved'.error);
    }
  } else {
    console.log('Error: No creds passed'.error);
  }
  process.exit(0);
}

/*
===========================================================================
  M O N I T O R
===========================================================================
*/
// * If using password can store access_token and info from conn etc(https://jsforce.github.io/document/#username-and-password-login). If the token fails then re-ask for password? or use refresh-token?
async function runMonitor(options) {
  var conn = await utils.setupOrgConn(options);
  conn.streaming.topic('CSUpdates').subscribe(function(message) {
    //console.log('Event : ' + JSON.stringify(message));
    var cs = message.sobject;
    if (
      (message.event.type == 'created' &&
        cs.mobilecaddy1__Session_Type__c != 'Sync - Update') ||
      (message.event.type == 'updated' &&
        cs.mobilecaddy1__Session_Type__c == 'Sync - Update')
    ) {
      cs.mobilecaddy1__MC_Internal_Error_Number__c = cs.mobilecaddy1__MC_Internal_Error_Number__c
        ? cs['mobilecaddy1__MC_Internal_Error_Number__c'].error
        : 'OK '.info;

      if (!cs.mobilecaddy1__Mobile_Table_Name__c)
        cs.mobilecaddy1__Mobile_Table_Name__c = '';
      if (cs.mobilecaddy1__Mobile_Table_Name__c == 'Connection_Session__mc')
        cs.mobilecaddy1__Mobile_Table_Name__c = 'Conn_Sess__mc';

      switch (cs.mobilecaddy1__Session_Type__c) {
        case 'New Install':
          monitorPrintNewInstall(cs);
          break;
        case 'Sync - Refresh':
          monitorPrintRefresh(cs);
          break;
        case 'Sync - Update':
          monitorPrintUpdate(cs);
          break;
        default:
          monitorPrintOther(cs);
      }
    }
  });
}

function monitorPrintNewInstall(cs) {
  console.log(
    cs['Name'].data +
      ' | ' +
      cs.mobilecaddy1__MC_Internal_Error_Number__c +
      ' | ' +
      cs['mobilecaddy1__Session_Type__c']
  );
}

function monitorPrintRefresh(cs) {
  console.log(
    cs['Name'].data +
      ' | ' +
      cs.mobilecaddy1__MC_Internal_Error_Number__c +
      ' | ' +
      cs['mobilecaddy1__Session_Type__c'].padEnd(14, ' ') +
      ' | ' +
      cs['mobilecaddy1__Mobile_Table_Name__c'].padEnd(13, ' ')
  );
}

function monitorPrintUpdate(cs) {
  // TODO Hard delete, soft delete?
  var succTotal = '0',
    failTotal = '0';

  // Insert / Updare Success
  var succInsertCnt = cs.mobilecaddy1__Insert_Successes_Count__c
    ? cs.mobilecaddy1__Insert_Successes_Count__c
    : 0;
  var succUpdateCnt = cs.mobilecaddy1__Update_Successes_Count__c
    ? cs.mobilecaddy1__Update_Successes_Count__c
    : 0;
  succTotal = (succInsertCnt + succUpdateCnt).toString();

  // Insert Failures
  var failInsertDupeCnt = cs.mobilecaddy1__Insert_Failure_Duplication_Count__c
    ? cs.mobilecaddy1__Insert_Failure_Duplication_Count__c
    : 0;
  var failIFMFCnt = cs.mobilecaddy1__Insert_Failure_Match_Failures_Count__c
    ? cs.mobilecaddy1__Insert_Failure_Match_Failures_Count__c
    : 0;
  var failInsertCnt = cs.mobilecaddy1__Insert_Failures_Count__c
    ? cs.mobilecaddy1__Insert_Failures_Count__c
    : 0;
  // Update Failures
  var failUFMFCnt = cs.mobilecaddy1__Update_Failure_Match_Failures_Count__c
    ? cs.mobilecaddy1__Update_Failure_Match_Failures_Count__c
    : 0;
  var failUpCnt = cs.mobilecaddy1__Update_Failures_Count__c
    ? cs.mobilecaddy1__Update_Failures_Count__c
    : 0;
  failTotal =
    failInsertDupeCnt + failIFMFCnt + failInsertCnt + failUFMFCnt + failUpCnt;
  if (failTotal > 0) {
    failTotal = failTotal.toString().error;
  } else {
    failTotal = failTotal.toString().info;
  }

  console.log(
    cs['Name'].data +
      ' | ' +
      cs.mobilecaddy1__MC_Internal_Error_Number__c +
      ' | ' +
      cs['mobilecaddy1__Session_Type__c'].padEnd(14, ' ') +
      ' | ' +
      cs['mobilecaddy1__Mobile_Table_Name__c'].padEnd(13, ' ') +
      '\t| ' +
      succTotal.info +
      '-' +
      failTotal
  );
}

/*
===========================================================================
  N E W
===========================================================================
*/
function runNew() {
  if (args[1] && args[2]) {
    var appName = args[2];
    if (appName == '.') {
      console.error(
        "Invalid app name, you may not specify '.' as an app name".error
      );
      process.exit(0);
    }
    if (args[3]) {
      let path;
      // we have been supplied a path.
      if (fs.existsSync(args[3])) {
        console.log('Path exists');
        path =
          args[3].charAt(args[3].length - 1) == '/' ? args[3] : args[3] + '/';
        targetPath = path + appName;
        console.log('targetPath', targetPath);
      } else {
        console.error('Invalid path'.error + args[3].data);
        process.exit(0);
      }
    } else {
      targetPath = appName;
    }
    if (fs.existsSync(targetPath)) {
      console.error(
        ('Invalid app name "' + targetPath + '", directory already exists')
          .error
      );
      process.exit(0);
    }
    getTemplatesList().then(function(knownTemplates) {
      var template = _.find(knownTemplates, function(el) {
        return el.id == args[1];
      });
      if (!template) {
        if (validURL(args[1])) {
          template = { repo: args[1], name: 'dummy' };
        }
      }
      if (template) {
        console.log(
          'Cloning MobileCaddy template "' + args[1] + '" from ' + template.repo
        );
        fetchArchive(targetPath, appName, template)
          .then(function() {
            console.log('Clone complete'.info);
            return installNpmDeps(targetPath);
          })
          .then(function() {
            console.log('NPM dependencies installed'.info);
            // read the packag.json
            try {
              packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            } catch (err) {
              // do nothing
            }
            return installBowerDeps(targetPath);
          })
          .then(function(res) {
            if (res != 'no-bower.json')
              console.log('Bower dependencies installed'.info);

            if (getIonicVsn() >= 2) {
              return runInitNodeTask(targetPath);
            } else {
              return runInitGruntTask(targetPath);
            }
          })
          .then(function() {
            return replaceNamePlaceholders(appName);
          })
          .then(function() {
            console.log('Initialisation tasks completed'.info);
            return saveAppToConfig(appName, targetPath);
          })
          .then(function() {
            if (args[args.length - 1] == '--json') {
              console.log('DONE');
            }
            process.exit(0);
          })
          .catch(function(err) {
            if (args[args.length - 1] == '--json') {
              console.log(err);
            } else {
              console.error(err.error);
            }
            process.exit(0);
          });
      } else if (validURL(args[1])) {
        console.log('That looks like a URL, nice');
        process.exit(0);
      } else {
        console.error('Unknown template ' + args[1].error);
        process.exit(0);
      }
    });
  } else {
    console.error('You need more arguments, man!'.error);
    //optimist.showHelp();
    process.exit(0);
  }
}

function validURL(str) {
  var strRegex =
    '^((https|http|ftp)?://)' +
    "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?" + //ftp的user@
    '(([0-9]{1,3}.){3}[0-9]{1,3}' + // IP形式的URL- 199.194.52.184
    '|' + // 允许IP和DOMAIN（域名）
    "([0-9a-z_!~*'()-]+.)*" + // 域名- www.
    '([0-9a-z][0-9a-z-]{0,61})?[0-9a-z].' + // 二级域名
    '[a-z]{2,6})' + // first level domain- .com or .museum
    '(:[0-9]{1,4})?' + // 端口- :80
    '((/?)|' + // a slash isn't required if there is no file name
    "(/[0-9a-zA-Z_!~*'().;?:@&=+$,%#-]+)+/?)$";
  var re = new RegExp(strRegex);
  if (!re.test(str)) return false;
  else return true;
}

/*
===========================================================================
  S E R V E
===========================================================================
*/
function runServe() {
  maybeShowNodeWarning();

  var scrub = '';
  if (argv.scrub) {
    scrub = '--scrub=' + argv.scrub;
  }
  var local = '';
  if (argv.local) {
    local = '--local=true';
  }
  var rec = '';
  if (serveOptions.rec) {
    rec = '--rec';
  }

  // Maybe run the monitor command also
  if (serveOptions.monitor) {
    // TODO - Improve so that the CLI is help up whilst password is read
    runMonitor(serveOptions);
  }

  if (getIonicVsn() >= 2) {
    rec = rec == '' ? '' : 'record';
    var child = exec('npm run mobilecaddy cors ' + rec, { async: true });
    child.stdout.on('data', function(data) {});

    // Write command line params to temp file, to be used by CodeFlow in startup
    let mcParams = {
      scrub: false,
      local: false
    };
    if (argv.scrub) mcParams.scrub = true;
    if (argv.local) mcParams.local = true;
    fs.writeFileSync('www/mc-params.json', JSON.stringify(mcParams));

    // Run ionic serve. Note we use spawn here to maintain colourisation etc
    const spawn = require('child_process').spawn;
    let cmd = spawn('ionic', ['serve', '--p', '3030'], {
      shell: true,
      stdio: 'inherit'
    });
    cmd.on('exit', function(code) {
      console.log('exited ' + code);
    });
  } else {
    var child3 = exec('grunt serve ' + scrub + ' ' + local + ' ' + rec, {
      async: true
    });
    child3.stdout.on('data', function(data) {});
  }
}

/*
===========================================================================
  T E M P L A T E S
===========================================================================
*/
function runTemplates() {
  getTemplatesList().then(function(knownTemplates) {
    knownTemplates.forEach(function(el) {
      console.log(el.id.info + ' : ' + el.desc);
    });
  });
}

/**
 * Runs NPN scripts to build desktop exe
 */
function runDesktopBuild() {
  const packageFile = 'package.json';
  const tmpPackageFile = packageFile + '.tmp';
  pjson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  if (args[1]) {
    var deployEnvName = args[1];
    var deployEnv = _.find(pjson.deployEnvs, function(el) {
      return el.name == deployEnvName;
    });
    if (deployEnv) {
      console.log(
        'Starting .exe build for "'.info +
          deployEnvName.data +
          '" with loginEndpoint "'.info +
          deployEnv.loginEndpoint.data +
          '"'
      );
      utils.writeToLog(mcBuildLog, '\n - - - - - - - - - - - - - - -');
      utils.writeToLog(
        mcBuildLog,
        '>>> Starting .exe build for "' +
          deployEnvName +
          '" with loginEndpoint ' +
          deployEnv.loginEndpoint
      );
      // Copy package.json to temp file
      fse
        .copy(packageFile, tmpPackageFile)
        .then(() => {
          // Replace variables
          var replace = require('replace');
          replace({
            regex: '<LOGIN-ENDPOINT>',
            replacement: deployEnv.loginEndpoint,
            paths: [packageFile],
            recursive: false,
            silent: true
          });
          replace({
            regex: '<DEPLOY-ENV>',
            replacement: deployEnv.name,
            paths: [packageFile],
            recursive: false,
            silent: true
          });
          // Run build command
          return utils.runShellTask('npm run dist');
        })
        .then(() => {
          // Move temp back to package.json
          return fse.copy(tmpPackageFile, packageFile);
        })
        .then(() => {
          // Remove temp files
          fs.unlink(tmpPackageFile, err => {
            if (err) {
              throw err;
            }
          });
          console.log('✔️ Build complete'.info);
          utils.writeToLog(mcBuildLog, '✔ .exe Build complete');
          process.exit(1);
        })
        .catch(err => {
          // Move temp back to package.json
          console.error('❌ .exe Build failed'.error);
          utils.writeToLog(mcBuildLog, '❌ .exe Build failed');
          // Move temp back to package.json
          fse.copy(tmpPackageFile, packageFile, { replace: true }, function(
            err2
          ) {
            if (err2) {
              console.error('Err2 ' + err2);
            }
            // Remove temp files
            fs.unlink(tmpPackageFile, err => {
              if (err) {
                console.error('Error removing temp file ' + err2);
              }
              process.exit(0);
            });
          });
        });
    } else {
      console.error('Could not find deploy-envs for '.error + deployEnvName);
      //optimist.showHelp();
      process.exit(0);
    }
  } else {
    console.error(
      'You need more arguments, man. Supply a deploy-envs.name!'.error
    );
    //optimist.showHelp();
    process.exit(0);
  }
}

/**
 * Bundles and Deploys an app to the org specified.
 * TODO - Currently it only bundles the app up. - Will use SFDX (or just access tokens)
 * TODO - Handle --prod flag too
 */
async function runDeploy() {
  // if (args[1]) {
  //   let sfdxAlias = args[1];
  // } else {
  //   console.error('You need more arguments, man. Supply a SFDX org alias!'.error);
  // }
  if (getIonicVsn() >= 2) {
    var conn = await utils.setupOrgConn(deployOptions);

    const deploy = require('./deploy.js');
    deploy
      .checkVersions(conn)
      .then(r => {
        return deploy.prepDeployAssets(deployOptions);
      })
      .then(r => {
        console.log('Deploy assets prepped'.info);
        return deploy.deploy(conn);
      })
      .then(r => {
        console.log('DEPLOY SUCCESSFUL'.info);
      })
      .catch(e => {
        console.error(e);
      });
  } else {
    console.log('Deploy via CLI is only supported with Ioinc2+ projects'.error);
    process.exit(0);
  }
}

/**
 * Runs NPN scripts to build desktop executables/installers
 */
function runDesktopMSIBuild() {
  const exemsiConfFile = 'build/exemsi.xml';
  const tmpExemsiConfFile = exemsiConfFile + '.tmp';
  pjson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (args[1]) {
    var deployEnvName = args[1];
    var deployEnv = _.find(pjson.deployEnvs, function(el) {
      return el.name == deployEnvName;
    });
    if (deployEnv) {
      console.log(
        'Starting .exe --> MSI conversion for "'.info +
          deployEnvName.data +
          '", v' +
          pjson.version.data
      );
      utils.writeToLog(mcBuildLog, '\n - - - - - - - - - - - - - - -');
      utils.writeToLog(
        mcBuildLog,
        '>>> Starting .exe --> MSI conversion for ' +
          deployEnvName +
          '", v' +
          pjson.version
      );
      // Copy package.json to temp file
      fse
        .copy(exemsiConfFile, tmpExemsiConfFile)
        .then(() => {
          // Replace variables
          var replace = require('replace');
          replace({
            regex: '<DEPLOY-ENV>',
            replacement: deployEnv.name,
            paths: [exemsiConfFile],
            recursive: false,
            silent: true
          });
          replace({
            regex: '<VERSION>',
            replacement: pjson.version,
            paths: [exemsiConfFile],
            recursive: false,
            silent: true
          });
          // Run build command
          return utils.runShellTask(
            '"C:\\Program Files (x86)\\MSI Wrapper\\MsiWrapperBatch.exe" config="build\\exemsi.xml"'
          );
        })
        .then(() => {
          // Move temp back to package.json
          return fse.copy(tmpExemsiConfFile, exemsiConfFile);
        })
        .then(() => {
          // Remove temp files
          fs.unlink(tmpExemsiConfFile, err => {
            if (err) {
              throw err;
            }
          });
          console.log('✔️ Conversion complete'.info);
          utils.writeToLog(mcBuildLog, '✔ Conversion complete');
          process.exit(1);
        })
        .catch(err => {
          // Move temp back to exemsi conf
          console.error('❌ MSI conversion failed'.error);
          utils.writeToLog(mcBuildLog, '❌ MSI conversion failed');
          // Move temp back to package.json
          fse.copy(
            tmpExemsiConfFile,
            exemsiConfFile,
            { replace: true },
            function(err2) {
              if (err2) {
                console.error('Err2 ' + err2);
              }
              // Remove temp files
              fs.unlink(tmpExemsiConfFile, err => {
                if (err) {
                  console.error('Error removing temp file ' + err2);
                }
                process.exit(0);
              });
            }
          );
        });
    } else {
      console.error('Could not find deploy-envs for '.error + deployEnvName);
      //optimist.showHelp();
      process.exit(0);
    }
  } else {
    console.error(
      'You need more arguments, man. Supply a deploy-envs.name!'.error
    );
    //optimist.showHelp();
    process.exit(0);
  }
}

/*
===========================================================================
  U N K N O W N    T A S K
===========================================================================
*/
function runUnknownTask() {
  let errStr = 'Unknown task ' + args[0] + '!';
  console.error(errStr.error);
  //optimist.showHelp();
  process.exit(0);
}

/*
===========================================================================
  P R I V A T E    F U N C T I O N S
===========================================================================
*/

/**
 * Gets the major Ionic version in use.
 * @return {integer | float}
 */
function getIonicVsn() {
  let ionicVsn = '';
  if (packageJson.devDependencies || packageJson.dependencies) {
    if (packageJson.dependencies && packageJson.dependencies['ionic-angular'])
      ionicVsn = packageJson.dependencies['ionic-angular'];

    if (packageJson.dependencies && packageJson.dependencies['ionic-sdk'])
      ionicVsn = packageJson.dependencies['ionic-sdk'];

    if (packageJson.devDependencies['ionic-sdk'])
      ionicVsn = packageJson.devDependencies['ionic-sdk'];

    ionicVsn = parseFloat(ionicVsn.replace(/[^\d.-]/g, ''));
  }
  return ionicVsn;
}

/*
 fetchArchive
 Desc: pulls git repo down and moves it into desired sub dir.
   Also does some small string replacement
 TODO : lots more can be done here based on CLI input
 */
function fetchArchive(targetPath, appName, template) {
  var q = Q.defer();
  var replace = require('replace');

  var archiveUrl = template.repo;
  // The folder name the project will be downloaded and extracted to
  var message = ['Downloading:'.bold, archiveUrl].join(' ');
  console.log(message);

  var tmpFolder = os.tmpdir();
  var tempZipFilePath = path.join(
    tmpFolder,
    'mobilecaddy-' + new Date().getTime()
  );

  new Download({ mode: '755', extract: true })
    .get(archiveUrl)
    .dest(tempZipFilePath)
    .run(function(err, files) {
      if (!err) {
        fs.rename(files[0].path, targetPath, function(res) {
          if (!res) {
            replace({
              regex: template.name,
              replacement: appName,
              paths: [targetPath],
              recursive: true,
              silent: true
            });
            q.resolve();
          } else {
            console.error('Renaming template repo failed '.error);
            console.error(res);
            q.reject(res);
          }
        });
      } else {
        console.error(err);
        q.reject(err);
      }
    });

  return q.promise;
}

function getTemplatesList() {
  var q = Q.defer();
  request(
    { uri: 'http://developer.mobilecaddy.net/cli-templates.php', json: true },
    function(error, response, body) {
      if (!error && response.statusCode == 200) {
        q.resolve(body);
      } else {
        console.error('Error retrieving known templates list\n'.error);
        console.error('These are the last known templates;');
        q.resolve(knownTemplates2);
      }
    }
  );
  return q.promise;
}

function installNpmDeps(targetPath) {
  return new Promise(function(resolve, reject) {
    console.log(
      'Installing project NPM dependencies into ' +
        targetPath +
        ' (may take a few moments)...'
    );
    cd(targetPath);
    var complete = false;
    var inRcvd = true;
    var sudoStr = os.platform() == 'darwin' || argv.sudo ? 'sudo ' : '';
    var child = exec(sudoStr + 'npm install', { async: true });
    child.stdout.on('data', function(data) {
      //console.log('npm data: ' + data);
      //q.resolve();
      inRcvd = true;
    });
    child.stderr.on('data', function(data) {
      //console.log('\n: ' + data);
      inRcvd = true;
    });

    child.on('close', function(code) {
      complete = true;
      if (code !== 0) {
        console.log('Boo! NPM process exited with code ' + code);
        reject(code);
      } else {
        console.log('YAY! NPM process exited OK.');
        resolve();
      }
    });

    var cState = 0; // cursor state for
    setInterval(function() {
      if (!complete) {
        if (inRcvd) {
          console.log('\n');
          inRcvd = false;
        }
        try {
          process.stdout.clearLine(); // clear current text
          process.stdout.cursorTo(0); // move cursor to beginning of line
          switch (cState) {
            case 0:
              process.stdout.write('[\\]'); // write text
              cState = 1;
              break;
            case 1:
              process.stdout.write('[|]'); // write text
              cState = 2;
              break;
            case 2:
              process.stdout.write('[/]'); // write text
              cState = 3;
              break;
            case 3:
              process.stdout.write('[-]'); // write text
              cState = 0;
              break;
          }
        } catch (e) {
          // do nothing.
        }
      } else {
        clearInterval();
      }
    }, 800);
  });
}

function installBowerDeps(targetPath) {
  return new Promise(function(resolve, reject) {
    if (fs.existsSync('bower.json')) {
      console.log(
        'Installing project bower dependencies (may take a few moments)...'
      );
      var child = exec('bower install', function(code, output) {
        resolve();
      });
    } else {
      resolve('no-bower.json');
    }
  });
}

/**
 * Runs 'grunt devsetup' to move stuff around, rename things etc
 * For v1 only
 * @param  {string} targetPath
 */
function runInitGruntTask(targetPath) {
  var q = Q.defer();
  console.log('Running initial grunt tasks...');
  var child = exec('grunt devsetup', function(code, output) {
    q.resolve();
  });
  return q.promise;
}

/**
 * Runs initialising stuff to move stuff around, rename things etc
 * For v1 only
 * @param  {string} targetPath
 */
function runInitNodeTask(targetPath) {
  return new Promise(function(resolve, reject) {
    console.log('Running MobileCaddy project initialisation tasks...');
    var child = exec('npm run mobilecaddy setup', function(code, output) {
      resolve();
    });
  });
}

/**
 * Replaces name placeholders throughout new project
 * @param  {string} appName
 * @return {promise}
 */
function replaceNamePlaceholders(appName) {
  return new Promise(function(resolve, reject) {
    console.log('Renaming placeholders...');
    const replace = require('replace-in-file');
    // package.json
    let options = {
      files: 'package.json',
      from: /[\"|\']name[\"|\'].*/g,
      to: '"name": "' + appName + '",'
    };
    replace(options)
      .then(function(result) {
        return utils.replaceHtmlTitles(appName);
      })
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

function saveAppToConfig(appName, targetPath) {
  var q = Q.defer();
  objs = db.allSync();
  if (objs.apps) {
    objs.apps.push({ name: appName, dir: targetPath });
    db.saveSync('apps', objs.apps);
    q.resolve();
  } else {
    q.reject('Error: Saving to config failed');
  }
  return q.promise;
}

/**
 * Checks node version, shows error if trying to use incompatible versions, and exits processing.
 * MobileCaddy Ionic2+ projects use functions available as of node 8.5.0.
 */
function maybeShowNodeWarning() {
  // Warn about node version needed for ng/Ionic v2
  nodeVsn = process.version.replace(/[^\d.-]/g, '');
  var cmp = compareVersions(nodeVsn, '8.5.0');
  if (getIonicVsn() > 2 && cmp < 0) {
    console.log(
      'You need to be running node 8.5.0+ to use Angular v2+ / Ionic v2+'.error
    );
    process.exit(0);
  }
}

/**
 * Compares two semver strings, the 1st against the 2nd.
 * @returns {intger} -1 = lower, 0 = equals, 1 = higher
 */
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

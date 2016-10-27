### 1.2.1


#### Bug Fixes

* NONE

#### Features

* Improved error output during renaming of tmp files when creating new project

#### Breaking Changes

* NONE


### 1.1.0


#### Bug Fixes

* For new project we now wait till 'npm install' process has completed

#### Features

* Better error output of trying to use app name that matches existing dir.
* Better output during NPM install
* Optionally run 'bower install' based upon existence of bower.json

#### Breaking Changes

* none


### 1.0.0


#### Bug Fixes

* none

#### Features

* Can now use any git zip URL as the template
* Known templates (MobileCaddy ones) are pulled dynamically without a need for mobilecaddy-cli upate
* short -v etc and now returns version info of current project
* Added help info about running sub-commands with sudo

#### Breaking Changes

* none


### 0.0.3


#### Bug Fixes

* none

#### Features

* Added "sudo" to *npm* commands if on Mac OS. Also available is *--sudo* flag.

#### Breaking Changes

* none


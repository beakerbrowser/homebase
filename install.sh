#!/usr/bin/env bash

# (thanks to creationix. I lifted this thing from nvm.)

{ # this ensures the entire script is downloaded #

homebase_has() {
  type "$1" > /dev/null 2>&1
}

homebase_minimum_node_version() {
  echo "4"
}

#
# Automatically install Node.js using nvm
#
homebase_install_node() {
  # node already installed?
  echo "=> Checking for Node.js"
  if [ -z "$HOMEBASE_INSTALL_NODE" ] && homebase_has "node"; then
    # make sure we have the minimum node version
    if node -e "process.exit(+(process.argv[1].slice(1).split('.')[0]) > (+process.argv[2]) ? 1 : 0)" $(node --version) $(homebase_minimum_node_version); then
      echo ""
      echo "You have an old version of node installed. Homebase requires $(homebase_minimum_node_version).0.0 or higher."
      echo "You can set HOMEBASE_INSTALL_NODE=1 to have the install script install the latest LTS version of node for you."
      exit 1
    fi

    # node is installed
    return 0
  fi

  # install nvm
  echo "=> Installing NVM (Node Version Manager)"
  if homebase_has "curl"; then
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
    echo "install via curl"
  else
    wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
    echo "install via wget  "
  fi
  source ~/.bashrc

  # install node
  echo "=> Installing latest LTS version of Node.js"
  nvm install --lts
}

install_homebase() {
  echo "=> Installing Homebase"
  if [ -z "$HOMEBASE_INSTALL_SOURCE" ]; then
    npm install -g @beaker/homebase
  else
    npm install -g "$HOMEBASE_INSTALL_SOURCE"
  fi
}

homebase_do_install() {
  homebase_install_node
  install_homebase
}

#
# Unsets the various functions defined
# during the execution of the install script
#
homebase_reset() {
  unset -f homebase_has homebase_install_dir homebase_latest_version homebase_profile_is_bash_or_zsh \
    homebase_source homebase_node_version homebase_download install_homebase_from_git homebase_install_node \
    install_homebase homebase_try_profile homebase_detect_profile homebase_check_global_modules \
    homebase_do_install homebase_reset
}

[ "_$HOMEBASE_ENV" = "_testing" ] || homebase_do_install

} # this ensures the entire script is downloaded #
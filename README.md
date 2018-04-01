# Homebase

**WIP: not ready for anybody to use**

Easy-to-administer server for [Dat](https://datprotocol.com) which integrates with [Beaker](https://beakerbrowser.com) and the [Dat CLI](https://npm.im/dat) using the [Pinning Service API](#TODO).

Homebase is designed for single users to quickly setup on their own linux-based servers and VPSes. It provides most of the same capabilities as [Hashbase](https://hashbase.io), but only supports one user. That makes it much easier to administer, since you can just use the shell and some config files.

It also supports adding & removing Dat archives using a HTTP API, which makes it possible to publish to Homebase via Beaker.

## How it works

 - You setup a server with a base domain (ie `yourdomain.com`) and run Homebase as a daemon.
 - You add Dat archives to Homebase and it acts as a peer to keep the archive online.
 - Each archive is given a name when its added to Homebase. That archive then becomes available at `dat://{name}.yourdomain.com`.
 - If enabled, Homebase can provide mirroring for the archives over https, so that they are accessible at `https://{name}.yourdomain.dom`.

Custom domain names:

 - You can also set custom domains for your archives, so they're also available at `dat://{customdomain}`.
 - HTTPS mirroring also works on the custom domain, ie `https://{customdomain}`.

[Beaker](https://beakerbrowser.com) and [Dat CLI](https://npm.im/dat) integration by the [Pinning Service API](#TODO):

 - You specify a password for the `admin` account.
 - The pinning service is made available at `https://yourdomain.com`.
 - You add `yourdomain.com` to Beaker as one of your pinning services.
 - You can now add & remove archives to your Homebase using Beaker.

Other features:

 - TLS certs are automatically fetched with Let's Encrypt.
 - There's an optional [metrics dashboard](#metrics-dashboard) if you want to track analytics.

## Installation (Ubuntu)

You will need [nodejs](https://nodejs.org) version 4.9.1 or greater.

### Install script

To install or update Homebase, you can use the install script using curl:

```
curl -o- https://raw.githubusercontent.com/beakerbrowser/homebase/v1.0.0/install.sh | bash
```

or wget:

```
wget -qO- https://raw.githubusercontent.com/beakerbrowser/homebase/v1.0.0/install.sh | bash
```

Next, [setup your daemon](#setup).

### Manual install steps (alternative to install script)

You'll need to install some build dependencies:

```
# install build dependencies
sudo apt-get install libtool m4 automake libcap2-bin build-essential
```

Then install Homebase globally. See [this guide](https://docs.npmjs.com/getting-started/fixing-npm-permissions) if you run into permissions problems.

```
# install homebase
npm install -g @beaker/homebase
```

Because Homebase will use privileged ports 80 and 443, you'll need to give nodejs permission to use them. (It's not recommended to run Homebase as super-user.)

```js
# give node perms to use ports 80 and 443
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``
```

Finally, to manage your daemon, install [pm2](https://www.npmjs.com/package/pm2):

```js
# install pm2
npm install -g pm2
```

Next, [setup your daemon](#setup).

## Setup

If you want to run Homebase manually, you can invoke the command `homebase`. However, for keeping the daemon running, we recommend `pm2`.

```
# start homebase
pm2 start homebase
```

To configure your instance, edit `~/.homebase.yml`. You can edit this even if the homebase daemon is running, and it will automatically restart after changes to adopt the new config.

```
# configure
emacs ~/.homebase.yml
```

Here is an example config file:

```yaml
directory: ~/.homebase
domain: # enter your homebase instance's domain here
httpMirror: true
webapi:
  enabled: true
  password: # enter your password here
letsencrypt:
  email: # enter your personal email here
  agreeTos: true
ports:
  http: 80
  https: 443
dashboard:
  enabled: true
  port: 8089
dats:
  - url: # enter the URL of the dat here
    name: # enter the name of the dat here
    domain: # enter one or more domains here
proxies:
  - from: # enter the domain to accept requests from
    to: # enter the domain (& port) to target
redirects:
  - from: # enter the domain to accept requests from
    to: # enter the domain to redirect to
```

You'll want to configure the following items:

 - **Domain**. Set the `domain:` field to the top-level domain name of your Homebase instance. New archives will be hosted under its subdomains.
 - **Web API**. Set a password on the Web API if you want to publish to your Homebase using Beaker or the Dat CLI.
 - **Let's Encrypt**. This is required for accessing your archives with domain names. You'll need to provide your email address so that Let's Encrypt can warn you about expiring certs, or other issues.
 - **Dats**. Add the archives that you want hosted. Each one will be kept online and made available at `dat://{name}.yourdomain.com`. The `domain` field is optional, and can take 1 or more additional domains for hosting the archive at. You can also add & remove archives using Beaker or the Dat CLI via the Web API.

Here's an example dat with multiple domains:

```yaml
dats:
  - url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    name: mysite
    domain:
      - mysite.com
      - my-site.com
```

Here's an example proxy rule:

```yaml
proxies:
  - from: my-proxy.com
    to: http://localhost:8080
```

Here's an example redirect rule:

```yaml
redirects:
  - from: my-old-site.com
    to: https://my-site.com
```

Some other steps to make sure your Homebase instance works:

 - **Firewall rules**. Make sure your server is accessible by port 80 (http), 443 (https), and 3282 (dat).
 - **DNS records**. Be sure to create A records for all of your domains which point to your server's IP address.

To stop the daemon, run

```
# stop homebase
pm2 stop homebase
```

## Config

The fields in detail.

### directory

The directory where homebase will store your Dat archive's files. Defaults to ~/.homebase.

### domain

The DNS domain of your homebase instance.

### httpMirror

Set to `true` to provide https mirroring of your Dat archives. Defaults to true.

### webapi.enabled

Set to `true` to provide the [Pinning Service API](#TODO) for integration with [Beaker](https://beakerbrowser.com) and the [Dat CLI](https://npm.im/dat). Defaults to false.

### webapi.password

Sets the password for your pinning service API. The username will be `admin`.

### letsencrypt.email

The email to send Lets Encrypt notices to.

### letsencrypt.agreeTos

Do you agree to the terms of service of Lets Encrypt? (Required, must be true)

### ports.http

The port to serve the HTTP sites. Defaults to 80.

HTTP automatically redirects to HTTPS.

### ports.https

The port to serve the HTTPS sites. Defaults to 443.

### dashboard.enabled

Set to `true` to provide the [prometheus metrics dashboard](#metrics-dashboard). Defaults to false.

### dashboard.port

The port to serve the [prometheus metrics dashboard](#metrics-dashboard). Defaults to 8089.

### dats

A listing of the Dat archives to host.

You'll need to configure the DNS entry for the hostname to point to the server. For instance, if using `site.yourhostname.com`, you'll need a DNS entry pointing `site.yourhostname.com` to the server.

### dats.*.url

The Dat URL of the site to host.

### dats.*.name

The name of the Dat archive. Must be unique on the Homebase instance. The archive will be hosted at `{name}.yourhostname.com`. You'll need to configure the DNS entry for the hostname to point to the server.

### dats.*.domain

Additional domains of the Dat archive. Can be a string or a list of strings. You'll need to configure the DNS entry for the hostname to point to the server.

### proxies

A listing of domains to proxy. Useful when your server has other services running that you need available.

### proxies.*.from

The domain to proxy from.

### proxies.*.to

The protocol, domain, and port to proxy to.

### redirects

A listing of domains to redirect.

### redirects.*.from

The domain to redirect from.

### redirects.*.to

The base URL to redirect to.

## Command Line Flags

  - `--config <path>` use the config file at the given path instead of the default `~/.dathttpd.yml`. Overrides the value of the `DATHTTPD_CONFIG` env var.

## Env Vars

  - `HOMEBASE_CONFIG=cfg_file_path` specify an alternative path to the config than `~/.homebase.yml`
  - `NODE_ENV=debug|staging|production` set to `debug` or `staging` to use the lets-encrypt testing servers.

## Metrics Dashboard

Homebase has built-in support for [Prometheus](https://prometheus.io), which can be visualized by [Grafana](http://grafana.org/).

![./grafana-screenshot.png](./grafana-screenshot.png)

Homebase exposes its metrics at port 8089. Prometheus periodically scrapes the metrics, and stores them in a database. Grafana provides a nice dashboard. It's a little daunting at first, but setup should be relatively painless.

Follow these steps:

 1. [Install Prometheus](https://prometheus.io/download/) on your server.
 2. [Install Grafana](http://grafana.org/download/) on your server.
 3. Update the `prometheus.yml` config.
 4. Start prometheus and grafana.
 5. Login to grafana.
 6. Add prometheus as a data source to grafana. (It should be running at localhost:9090.)
 7. Import [this grafana dashboard](./grafana-dashboard.json).

Your prometheus.yml config should include have the scrape_configs set like this:

```yml
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'homebase'
    static_configs:
      - targets: ['localhost:8089']
```

Report any issues you have along the way!

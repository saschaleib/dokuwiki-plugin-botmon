<?php

use dokuwiki\Extension\AdminPlugin;

/**
 * Bot Monitoring Plugin
* 
* @license    GPL 2 (http://www.gnu.org/licenses/gpl.html)
* @author     Sascha Leib <ad@hominem.info>
*/

/**
 * All DokuWiki plugins to extend the admin function
 * need to inherit from this class
**/
class admin_plugin_botmon extends AdminPlugin {

	/**
	 * Return the path to the icon being displayed in the main admin menu.
	 *
	 * @return string full path to the icon file
	**/
	public function getMenuIcon() {
		$plugin = $this->getPluginName();
		return DOKU_PLUGIN . $plugin . '/img/admin.svg';
	}

	/**
	 * output appropriate html
	*/
	public function html() {

		global $conf;

		// spinner animation as SVG image:
		$svg = '<svg width="12" height="12" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" id="botmon__today__busy"><defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#666"></stop><stop offset="100%" stop-color="#666"></stop></linearGradient></defs><circle cx="25" cy="25" r="20" fill="none" stroke="url(#gradient)" stroke-width="8" stroke-dasharray="31.4 31.4"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"></animateTransform></circle></svg>';

		$pluginPath = $conf['basedir'] . 'lib/plugins/' . $this->getPluginName();

		/* Plugin Headline */
		echo '<div id="botmon__admin">
	<h1>Bot Monitoring Plugin</h1>
	<nav id="botmon__tabs">
		<ul class="tabs" role="tablist">
			<li role="presentation" class="active"><a role="tab" href="#botmon__panel1" aria-controls="botmon__panel1" id="botmon__tab1" aria-selected="true">Today</a></li>
		</ul>
	</nav>';

	if ($this->hasOldLogFiles()) {
		echo '<div class="info"><strong>Note:</strong> There are old log files that can be deleted. <a href="' . $pluginPath . '/cleanup.php" target="_blank">Click here</a> to run a delete script, or use <em>cron</em> to automatically delete them.</div>';
	}

	echo '<article role="tabpanel" id="botmon__today"">
		<h2 class="a11y">Today</h2>
		<header id="botmon__today__title">Loading&nbsp;&hellip;</header>
		<div id="botmon__today__content">
			<details id="botmon__today__overview" open>
				<summary>Bot overview (page views)</summary>
				<div class="botmon_bots_grid">
					<dl id="botmon__today__botsvshumans"></dl>
					<dl id="botmon__botslist"></dl>
					<dl id="botmon__today__countries"></dl>
				</div>
			</details>
			<details id="botmon__today__webmetrics">
				<summary>Web metrics</summary>
				<div class="botmon_webmetrics_grid">
					<dl id="botmon__today__wm_overview"></dl>
					<dl id="botmon__today__wm_clients"></dl>
					<dl id="botmon__today__wm_platforms"></dl>
					<dl id="botmon__today__wm_referers"></dl>
				</div>
			</details>
			<details id="botmon__today__visitors">
				<summary>Visitor logs</summary>
				<div id="botmon__today__visitorlists"></div>
			</details>
		</div>
		<footer aria-live="polite">
			<span>' . $svg . '</span>
			<span id="botmon__today__status">Initialising&nbsp;&hellip;</span>
		</footer>
	</article>
</div><!-- End of BotMon Admin Tool -->';

	}

	/**
	 * Check if there are old log files that can be deleted.
	 * 
	 * @return bool true if there are old log files, false otherwise
	 */
	private function hasOldLogFiles() {
		
		$today = gmdate('Y-m-d');
		$yesterday = gmdate('Y-m-d', time() - 86400);

		// scan the log directory and delete all files except for today and yesterday:
		$dir = scandir(getcwd() . '/lib/plugins/botmon/logs');
		foreach($dir as $file) {
			$fName = pathinfo($file, PATHINFO_BASENAME);
			$bName = strtok($fName, '.');

			if ($bName == '' || $bName == 'logfiles') {
				// ignore
			} else if ($bName == $today || $bName == $yesterday) {
				// skip
			} else {
				return true;
			}
		}
		return false;
	}
} 
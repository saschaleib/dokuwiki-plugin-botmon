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

		$pluginPath = $conf['basedir'] . 'lib/plugins/' . $this->getPluginName();

		/* Plugin Headline */
		echo '<div id="botmon__admin">';
		echo '<h1>Bot Monitoring Plugin</h1>';

		/* tab navigation */
		echo '<nav id="botmon__tabs">';
		echo '<ul class="tabs" role="tablist">';
		echo '<li role="presentation" class="active">';
		echo '<a role="tab" href="#botmon__panel1" aria-controls="botmon__panel1" id="botmon__tab1" aria-selected="true">Today</a></li>';
		echo '</ul></nav>';

		// Beta warning message:
		echo '<div class="info"><strong>Please note:</strong> This plugin is still in the early stages of development and does not (yet) clean up its <code>logs</code> directory.<br>You can clean up the old log files by <a href="' . $pluginPath . '/cleanup.php" target="_blank">clicking here</a>, or by adding the cleanup script to your cron jobs.</div>';

		/* Live tab */
		echo '<article role="tabpanel" id="botmon__today"">';
		echo '<h2 class="a11y">Today</h2>';
		echo '<header id="botmon__today__title">Loading&nbsp;&hellip;</header>';
		echo '<div id="botmon__today__content">';
		echo '<details id="botmon__today__visitors"><summary>Visitor logs</summary>';
		echo '<div id="botmon__today__visitorlists"></div>';
		echo '</details></div>';
		echo '<footer aria-live="polite"><img src="' . $pluginPath . '/img/spinner.svg" id="botmon__today__busy" width="12" height="12" alt="busy indicator"><span id="botmon__today__status">Initialising&nbsp;&hellip;</span></footer>';
		echo '</article>';
		echo '</div><!-- End of BotMon Admin Tool -->';

	}
} 
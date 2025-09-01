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

		$svg = '<svg width="60" height="60" id="botmon__today__busy" viewBox="0 0 38 38"><g transform="translate(19 19)"><g transform="rotate(0)"><circle cx="0" cy="12" r="3" opacity="0.125"><animate attributeName="opacity" from="0.125" to="0.125" dur="1.2s" begin="0s" repeatCount="indefinite" keyTimes="0;1" values="1;0.125"></animate></circle></g><g transform="rotate(45)"><circle cx="0" cy="12" r="3" opacity="0.25"><animate attributeName="opacity" from="0.25" to="0.25" dur="1.2s" begin="0.15s" repeatCount="indefinite" keyTimes="0;1" values="1;0.25"></animate></circle></g><g transform="rotate(90)"><circle cx="0" cy="12" r="3" opacity="0.375"><animate attributeName="opacity" from="0.375" to="0.375" dur="1.2s" begin="0.3s" repeatCount="indefinite" keyTimes="0;1" values="1;0.375"></animate></circle></g><g transform="rotate(135)"><circle cx="0" cy="12" r="3" opacity="0.5"><animate attributeName="opacity" from="0.5" to="0.5" dur="1.2s" begin="0.45s" repeatCount="indefinite" keyTimes="0;1" values="1;0.5"></animate></circle></g><g transform="rotate(180)"><circle cx="0" cy="12" r="3" opacity="0.625"><animate attributeName="opacity" from="0.625" to="0.625" dur="1.2s" begin="0.6s" repeatCount="indefinite" keyTimes="0;1" values="1;0.625"></animate></circle></g><g transform="rotate(225)"><circle cx="0" cy="12" r="3" opacity="0.75"><animate attributeName="opacity" from="0.75" to="0.75" dur="1.2s" begin="0.75s" repeatCount="indefinite" keyTimes="0;1" values="1;0.75"></animate></circle></g><g transform="rotate(270)"><circle cx="0" cy="12" r="3" opacity="0.875"><animate attributeName="opacity" from="0.875" to="0.875" dur="1.2s" begin="0.9s" repeatCount="indefinite" keyTimes="0;1" values="1;0.875"></animate></circle></g><g transform="rotate(315)"><circle cx="0" cy="12" r="3" opacity="1"><animate attributeName="opacity" from="1" to="1" dur="1.2s" begin="1.05s" repeatCount="indefinite" keyTimes="0;1" values="1;1"></animate></circle></g></g></svg>';

		/* Plugin Headline */
		echo '<div id="botmon__admin">';
		echo '<h1>Bot Monitoring Plugin</h1>';

		/* tab navigation */
		echo '<nav id="botmon__tabs">';
		echo '<ul class="tabs" role="tablist">';
		echo '<li role="presentation" class="active">';
		echo '<a role="tab" href="#botmon__panel1" aria-controls="botmon__panel1" id="botmon__tab1" aria-selected="true">Today</a></li>';
		echo '</ul></nav>';

		/* Live tab */
		echo '<article role="tabpanel" id="botmon__today"">';
		echo '<h2 class="a11y">Today</h2>';
		echo '<header id="botmon__today__title">Loading&nbsp;&hellip;</header>';
		echo '<div id="botmon__today__content">';
		echo '<details id="botmon__today__visitors"><summary>Visitor log</summary>';
		echo '<ul id="botmon__today__visitorlist"></ul>';
		echo '</details></div>';
		echo '<footer aria-live="polite">' . $svg . '<span id="botmon__today__status">Initialising&nbsp;&hellip;</span></footer>';
		echo '</article>';
		echo '</div><!-- End of BotMon Admin Tool -->';

	}
} 
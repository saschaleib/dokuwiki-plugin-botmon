<?php
/**
 * Configuration settings for the BotMon Plugin
 *
 * @author     Sascha Leib <sascha@leib.be>
 */

$meta['geoiplib'] = array('multichoice',
						'_choices' => array ('disabled', 'phpgeoip'));

$meta['useCaptcha'] = array('onoff');
$meta['captchaSeed'] = array('string', '_pattern' => '/[\da-fA-F]{16,32}/');

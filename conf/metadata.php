<?php
/**
 * Configuration settings for the BotMon Plugin
 *
 * @author     Sascha Leib <sascha@leib.be>
 */

$meta['geoiplib'] = array('multichoice',
						'_choices' => array ('disabled', 'phpgeoip'));

//$meta['useCaptcha'] = array('onoff');
$meta['useCaptcha'] = array('multichoice',
						'_choices' => array ('disabled', 'blank', 'dada'));
$meta['captchaSeed'] = array('string');

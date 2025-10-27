<?php
/**
 * Configuration settings for the BotMon Plugin
 *
 * @author     Sascha Leib <sascha@leib.be>
 */

$meta['showday'] = array('multichoice',
						'_choices' => array ('yesterday', 'today'));

$meta['combineNets'] = array('onoff');

$meta['geoiplib'] = array('multichoice',
						'_choices' => array ('disabled', 'phpgeoip'));

$meta['useCaptcha'] = array('multichoice',
						'_choices' => array ('disabled', 'loremipsum', 'dada'));
$meta['captchaSeed'] = array('string');

import $ from 'jquery';
import 'bootstrap';
import ClipboardJS from 'clipboard';
import { sep } from 'path';

// Import only the used highlights from highlight.js (saves about 1MB)
// import hljs from 'highlight.js';
import hljs from 'highlight.js/lib/highlight';
import apache from 'highlight.js/lib/languages/apache';
import ini from 'highlight.js/lib/languages/ini';
import json from 'highlight.js/lib/languages/json';
import nginx from 'highlight.js/lib/languages/nginx';
import yaml from 'highlight.js/lib/languages/yaml';
import ps from 'highlight.js/lib/languages/powershell';
hljs.registerLanguage('apache', apache);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('json', json);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('ps', ps);

import '../css/index.scss';

import { validHashKeys } from './constants.js';
import configs from './configs.js';
import state from './state.js';
import { sleep } from './utils.js';


// note if any button has changed so that we can update the fragment if it has
let gHaveSettingsChanged = false;

// import all the templates by name, e.g. apache --> require(apache.hbs)
const templates = {};
const templateContext = require.context('../templates/partials', true, /\.hbs$/);
templateContext.keys().forEach(key => {
  templates[key.split(sep).slice(-1)[0].split('.')[0]] = templateContext(key);
});


const render = async () => {
  const _state = await state();

  // enable and disable the appropriate fields
  $('#server-version').toggleClass('text-disabled', _state.output.hasVersions === false);
  $('#openssl-version').toggleClass('text-disabled', _state.output.usesOpenssl === false);
  $('#hsts').prop('disabled', _state.output.supportsHsts === false);
  $('#ocsp').prop('disabled', _state.output.supportsOcspStapling === false);

  // update the fragment
  if (gHaveSettingsChanged) {
    window.location.hash = _state.output.fragment;
  }
  
  // render the output header
  document.getElementById('output-header').innerHTML = templates.header(_state);

  // and the config file for whichever server software we're using
  const renderedTemplate = _state.output.protocols.length === 0 ? templates['nosupport'](_state) : templates[_state.form.server](_state);

  // show / hide the copy button as needed
  document.getElementById('copy').classList.toggle('d-none', _state.output.protocols.length === 0);
  
  // syntax highlight and enter into the page
  const highlighter = configs[_state.form.server].highlighter;

  document.getElementById('output-config').innerHTML = hljs.highlight(highlighter, renderedTemplate, true).value;
};


// set a listen on the form to update the state
$().ready(() => {
  // set all the buttons to the right thing
  if (window.location.hash.length > 0) {
    const mappings = {
      'true': true,
      'false': false,
    };

    const params = new URLSearchParams(window.location.hash.substr(1));

    // set the default server version, if we're loading and have "server" but not "server-version"
    if (params.get('server') !== null && params.get('server-version') === null) {
      $('#server-version').val(configs[params.get('server')].latestVersion);
    }

    for (let entry of params.entries()) {
      // if it's in the mappings, we should do a find/replace
      entry[1] = mappings[entry[1]] === undefined ? entry[1] : mappings[entry[1]];

      if (validHashKeys.includes(entry[0])) {
        // find the element
        let e = document.getElementById(entry[0]) || document.querySelector(`input[name="${entry[0]}"][value="${entry[1]}"]`);

        if (!e || !e.type) {
          continue;
        }

        switch (e.type) {
          case 'radio':
          case 'checkbox':
            e.checked = entry[1];
            break;
          case 'text':
            e.value = entry[1];
        }

      }
    }
  }

  // update the global state with the default values
  render();

  // update state anytime the form is changed
  $('#form-config, #form-environment').on('change', async () => {
    gHaveSettingsChanged = true;
    render();
  });

  // anytime the server changes, so does the server version
  $('#form-server').on('change', async () => {
    gHaveSettingsChanged = true;
    const _state = await state();
    $('#server-version').val(_state.output.latestVersion);

    render();
  });

  // instantiate tooltips
  $('[data-toggle="tooltip"]').tooltip();

  // instantiate clipboard thingie
  const clipboard = new ClipboardJS('#copy');
  clipboard.on('success', async e => {
    $('#copy').tooltip('show');
    e.clearSelection();
    await sleep(750);
    $('#copy').tooltip('hide');
  });
});
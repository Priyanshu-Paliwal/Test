define([
  'postmonger',
], function (
  Postmonger
) {
  'use strict';
  var request = require([request]);
  var connection = new Postmonger.Session();
  var payload = {};
  var deData = {};
  var previewDEMapOptions = {};
  var authorization = {};
  let previewPayload = {
    isValid: true,
    templateEnvironment: '',
    envelopeEnvironment: '',
    contactEnvironment: '',
    liveApiKeyEnabled: false
  };
  var authToken, et_subdomain, authTSSD;
  let fromContact = {};
  let doesPayloadHasAPIKeys = true;
  let toContact = '';
  const POSTGRID_API_BASE_URL = 'https://api.postgrid.com/print-mail/v1/';
  let currentEnabledEnvironmenet = '';
  let mergeVariablesFields;

  var steps = [
    { 'label': 'Connect Account', 'key': 'step1' },
    { 'label': 'Select Message type', 'key': 'step2' },
    { 'label': 'Create', 'key': 'step3' },
    { 'label': 'Map Fields', 'key': 'step4' },
    { 'label': 'Preview', 'key': 'step5' }
  ];

  $(window).ready(onRender);

  function onRender() {
    $('.activity-loader').addClass('show');
    connection.trigger('updateButton', {
      button: 'next',
      enabled: false,
    });
    connection.trigger('requestSchema');
    connection.trigger('requestTokens');
    connection.trigger('requestEndpoints');
    connection.trigger('ready');
    $('#card-insert-type').addClass('hidden');
    $('.card-insert-creation-type-wrapper').addClass('hidden');
  }
  
  connection.on('initActivity', initialize);
  connection.on('clickedNext', onClickedNext);
  connection.on('clickedBack', onClickedBack);
  connection.on('gotoStep', onGotoStep);

  connection.on('requestedSchema', function (data) {
    var optionsData = '';
    const excludedFieldNames = [
      'First Name', 'Last Name', 'Company', 'Email Address',
      'Address Line 1', 'Address Line 2', 'City', 'State',
      'Country Code', 'PostalCode', 'SubscriberKey'
    ];
    const dataExtensionFields = data.schema;

    mergeVariablesFields = dataExtensionFields
      .filter(function(item) {
        return !excludedFieldNames.includes(item.name);
      })
      .map(function(item) {
        return item.name;
      });

    data['schema'].forEach(ele => {
      if(!mergeVariablesFields.includes(ele.name)) {
        optionsData +=`<option value="${ele.name}">${ele.name}</option>`;
      }
      var key = ele.key;
      const myArray = key.split('.');
      var value = myArray[0]+'.'+myArray[1]+'.'+'"'+ele.name+'"';  
      deData[ele.name]=value;     
    });
    $('.mapping-fields-group select').append(optionsData);
    connection.trigger('ready');
  });

  function initialize(data) {
    if (data) {
      payload = data;
    }
    var hasPostcardArguments = Boolean(
      payload['arguments'] &&
      payload['arguments'].execute &&
      payload['arguments'].execute.inArguments &&
      payload['arguments'].execute.inArguments.length > 0 &&
      payload['arguments'].execute.inArguments[0].internalPostcardJson
    );
    doesPayloadHasAPIKeys = hasPostcardArguments;
    var hasMapDESchema = Boolean(
      payload['arguments'] &&
      payload['arguments'].execute &&
      payload['arguments'].execute.inArguments &&
      payload['arguments'].execute.inArguments.length > 0 &&
      payload['arguments'].execute.inArguments[0].previewDEMapOptions
    );
    var postcardArguments = hasPostcardArguments ? payload['arguments'].execute.inArguments[0].internalPostcardJson : {};
    previewDEMapOptions = hasMapDESchema ?payload['arguments'].execute.inArguments[0].previewDEMapOptions : {};
    executeScreenTwoMethods();

    $.each(postcardArguments, function(key, value) {
      switch (key) {
      case 'test_api_key':
        $('#test-api-key').val(value).change();
        break;
      case 'live_api_key':
        $('#live-api-key').val(value).change();
        break;
      case 'creationType':
        $('input[name=\'createType\'][value=\'' + value + '\']').prop('checked', true);
        if(postcardArguments.cardInsertObj !== null){
          $('#card-insert').prop('checked', postcardArguments.cardInsertObj.cardInsertEnabled).trigger('change');
          $('input[name="cardType"][value=\'' + postcardArguments.cardInsertObj.cardInsertType + '\']').prop('checked', true);
          $('input[name="cardInsertType"][value=\'' + postcardArguments.cardInsertObj.cardInsertDesignFormat + '\']').prop('checked', true);
          previewPayload.cardInsertLayout = postcardArguments.cardInsertObj.cardInsertType;
          previewPayload.cardInsertDesignFormat = postcardArguments.cardInsertObj.cardInsertDesignFormat;
        }
        break;
      case 'senderContactType':
        previewPayload.prevContactType = value;
        $('input[name=\'senderContactType\'][value=\'' + value + '\']').prop('checked', true).trigger('change');
        break;
      case 'newContactFields':
        const newContact = value;
        $('#newContactFirstName').val(newContact.firstName);
        $('#newContactLastName').val(newContact.lastName);
        $('#newContactCompanyName').val(newContact.companyName);
        $('#newContactEmail').val(newContact.email);
        $('#newContactAddressLine1').val(newContact.addressLine1);
        $('#newContactAddressLine2').val(newContact.addressLine2);
        $('#newContactCity').val(newContact.city);
        $('#newContactState').val(newContact.provinceOrState);
        $('#newContactCountryCode').val(newContact.countryCode);
        $('#newContactPostal').val(newContact.postalOrZip);
        break;
      case 'messageType':
        if(value === 'trifold'){
          value = 'selfmailer';
        } else if(value === 'LettersCardInsert') {
          value = 'Letters';
        }
        if (value === 'selfmailer' || value === 'Letters') {
          $('#card-insert-container').addClass('visible');
          $('.card-insert-wrapper').addClass('visible');
        }
        $('input[name=\'msgType\'][value=\'' + value + '\']').prop('checked', true).trigger('change');
        break;
      case 'description':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .description';
        $(queryString).val(value);
        break;
      case 'frontTemplateName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .frontTemplate';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.frontTemplateId);
        break;
      case 'backTemplateName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .backTemplate';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.backTemplateId);
        break;
      case 'cardBackTemplateName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .card-back-template';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.cardBackTemplateId);
        break;
      case 'cardFrontTemplateName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .card-front-template';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.cardFrontTemplateId);
        break;
      case 'size':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' input[value="' + value + '"]';
        $(queryString).prop('checked', true);
        break;
      case 'isExpressDelivery':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .express-delivery-input';
        $(queryString).prop('checked', value).trigger('change');
        break;
      case 'frontHtmlContent':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .html-editor-front';
        $(queryString).val(value);
        break;
      case 'backHtmlContent':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .html-editor-back';
        $(queryString).val(value);
        break;
      case 'fromContact' :
        $('#search-contact').val(value.name).change();
        fromContact.id = value.id;
        fromContact.name = value.name;
        break;
      case 'pdf' :
        var queryString = `.${postcardArguments.messageType.replace(/\s+/g, '')} .${postcardArguments.creationType.replace(/\s+/g, '')} .pdfLink`;
        $(queryString).val(value);
        break;
      case 'mailingClass':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .mailing-class';
        $(queryString).val(value);
        break;
      case 'liveApiKeyEnabled':
        $('.test-to-live-switch input').prop('checked', value).trigger('change');
        const apiKeyEnabled = value ? 'Live' : 'Test';
        previewPayload.templateEnvironment = apiKeyEnabled;
        previewPayload.envelopeEnvironment = apiKeyEnabled;
        previewPayload.contactEnvironment = apiKeyEnabled;
        break;
      case 'cardfrontHtmlContent':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .html-editor-front-card-insert';
        $(queryString).val(value);
        break;
      case 'cardbackHtmlContent':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .html-editor-back-card-insert';
        $(queryString).val(value);
        break;
      case 'cardSize':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .cardSize';
        $(queryString).val(value);
        break;
      case 'pdfLinkInput':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .pdfLink';
        $(queryString).val(value);
        break;
      case 'cardPdfLink':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '') + ' .cardPdfLink';
        $(queryString).val(value);
        break;
      case 'singleSideTemplateName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .singleSideTemplate';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.singleSideTemplateId);
        break;
      case 'extraServiceName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .extra-service';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.extraService);
        $(`.${postcardArguments.messageType.replace(/\s+/g, '')} .${postcardArguments.creationType.replace(/\s+/g, '')} .extra-service-list .dropdown-item[data-id="${postcardArguments.extraService}"]`).trigger('click');
        break;
      case 'envelopeTypeName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .envelope-type';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.envelopeType);
        break;
      case 'returnEnvelopeName':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .returnEnvelope';
        $(queryString).val(value);
        $(queryString).attr('data-id', postcardArguments.returnEnvelope);
        break;
      case 'color':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .color-input';
        $(queryString).prop('checked',value);
        break;
      case 'perforatedPage':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .preforate-first-page-input';
        $(queryString).prop('checked',value).trigger('change');
        break;
      case 'doubleSided':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .double-sided-input';
        $(queryString).prop('checked',value);
        break;
      case 'addressPlacement':
        var queryString = '.' + postcardArguments.messageType.replace(/\s+/g, '') + ' .' + postcardArguments.creationType.replace(/\s+/g, '')+ ' .insert-blank-page-input';
        $(queryString).prop('checked',value).trigger('change');
        break;
      default:
        break;
      }
    });
    
    initializeHandler();
  }

  connection.on('requestedEndpoints', onGetEndpoints);
  function onGetEndpoints (endpoints) {
    et_subdomain = endpoints.restHost;        
    authTSSD = (endpoints.authTSSD).split('//')[1].split('.')[0];
  }

  connection.on('requestedTokens', async (tokens) => {
    await onGetTokens(tokens);
  });

  async function onGetTokens (tokens) {
    authToken = tokens.fuel2token;
    await fetchExternalKey('PostGrid_Credentials_Data');
    await fetchExternalKey('Postgrid_Logging_Data');
  }

  var currentStep = steps[0].key;
  function onClickedNext() {
    switch (currentStep.key) {
    case 'step1':
      const isClientCredentialsFetched = previewPayload.clientId !== undefined && previewPayload.clientId !== '' ? true : false;
      if (isClientCredentialsFetched && validateApiKeys()) {
        authenticateApiKeys().then((isAuthenticated) => {
          if (isAuthenticated) {
            handleApiKeyToggle();
            executeScreenTwoMethods();
            connection.trigger('nextStep');
          } else {
            handleValidationFailure();
          }
        }).catch((error) => {
          throw error;
        });
      }
      else{
        handleValidationFailure();
      }
      break;

    case 'step2':
      if (validateStep2()) {
        setDefaultValuesForPostCardCreation();
        $('#step3 .screen').toggle(false);
        let selectedMessageType;
        let selectedRadio = $('input[name="msgType"]:checked');
        let isCartInsertEnabled = $('#card-insert').prop('checked');
        let selectedCreationType = $('input[name=\'createType\']:checked').val().replace(/\s+/g, '');
        let selectedCardInsertDesignFormat = $('input[name=\'cardInsertType\']:checked').val().replace(/\s+/g, '');
        let isHtml = $('#htmlId').is(':checked');
        let isPdf = $('#pdfId').is(':checked');
        let isExtTemp = $('#extTempId').is(':checked');

        if (selectedRadio.length > 0) {
          let selectedRadioValue = selectedRadio.val().replace(/\s+/g, '');
          selectedMessageType = isCartInsertEnabled && selectedRadioValue === 'selfmailer' ? 'trifold'  : selectedRadioValue;
          if(isCartInsertEnabled && selectedRadioValue === 'selfmailer') {
            selectedMessageType = 'trifold';
          } else if(isCartInsertEnabled && selectedRadioValue === 'Letters' ) {
            selectedMessageType = 'LettersCardInsert';
          }
        }

        if (isCartInsertEnabled) {
          $('.trifold .doubleSide, .trifold .singleSide').hide();
          let selectedCardType = $('input[name="cardType"]:checked').val();
          $(`.trifold .${selectedCardType}`).show();
          if(selectedMessageType === 'LettersCardInsert') {
            if(previewPayload.cardInsertDesignFormat !== selectedCardInsertDesignFormat || previewPayload.cardInsertLayout !== selectedCardType) {
              previewPayload.cardInsertDesignFormat = selectedCardInsertDesignFormat;
              previewPayload.cardInsertLayout = selectedCardType;
              $(`.${selectedMessageType} .${selectedCreationType} .description`).val('');
              $(`.${selectedMessageType} .${selectedCreationType} .pdfLink`).val('');
              $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-area`).val('');
              $(`.${selectedMessageType} .${selectedCreationType} .returnEnvelope`).val('').attr('data-id','');
              $(`.${selectedMessageType} .${selectedCreationType} .frontTemplate`).val('').attr('data-id','');
              $(`.${selectedMessageType} .${selectedCreationType} .backTemplate`).val('').attr('data-id','');
              $(`.${selectedMessageType} .${selectedCreationType} .extra-service-list .dropdown-item[data-id=""]`).click();
              $(`.${selectedMessageType} .${selectedCreationType} .envelope-type-list .dropdown-item[data-id="standard_double_window"]`).click();
              $(`.${selectedMessageType} .${selectedCreationType} .checkboxes-container .checkbox-input`).prop('checked', false).trigger('change');
            }
            $('.card-insert-input').addClass('hidden');
            $('.html-btn-front').click();
            if(selectedCreationType === 'template-creation-type') {
              $('.html-btn-card-front').click();
            }
            $(`.card-insert-input-${selectedCardInsertDesignFormat}`).removeClass('hidden');
            if(selectedCardType === 'doubleSide'){
              $(`.card-insert-input-${selectedCardInsertDesignFormat}-${selectedCardType}`).removeClass('hidden');
            }
            if(selectedCreationType === 'pdf-creation-type' || selectedCreationType === 'template-creation-type') {
              $(`.${selectedMessageType} .${selectedCreationType}`).removeClass('html');
              $(`.${selectedMessageType} .${selectedCreationType}`).addClass('template');
              if(selectedCardInsertDesignFormat === 'html') {
                $(`.${selectedMessageType} .${selectedCreationType}`).addClass('html');
                $(`.${selectedMessageType} .${selectedCreationType}`).removeClass('template');
              }
            }
          }
        }

        $(`.${selectedMessageType} .error-msg`).removeClass('show');
        $(`.${selectedMessageType} input.error`).removeClass('error');

        if(isCartInsertEnabled){
          let selectedCardInsertType = $('input[name="cardType"]:checked').val();
          if(selectedCardInsertType === 'singleSide'){
            $(`.${selectedMessageType} .html-editor .singleSided-hide`).hide();
            $('.trifold .html-btn-card-front').text('Card Insert');
          }else{
            $(`.${selectedMessageType} .html-editor .singleSided-hide`).show();
            $('.trifold .html-btn-card-front').text('Card Inside');
          }
        }

        currentEnabledEnvironmenet = previewPayload.liveApiKeyEnabled ? 'Live' : 'Test';
        if(previewPayload.templateEnvironment !== currentEnabledEnvironmenet) {
          $(`.${selectedMessageType} .${selectedCreationType} .frontTemplate`).val('').attr('data-id', '');
          $(`.${selectedMessageType} .${selectedCreationType} .backTemplate`).val('').attr('data-id', '');
        }
        fetchTemplates();

        if(previewPayload.envelopeEnvironment !== currentEnabledEnvironmenet) {
          $(`.${selectedMessageType} .${selectedCreationType} .returnEnvelope`).val('').attr('data-id', '');
        }
        fetchReturnEnvelope();

        if(previewPayload.contactEnvironment !== currentEnabledEnvironmenet) {
          resetContactFields();
        }
        fetchContacts();

        $(`.${selectedMessageType} > .screen-1`).toggle(isHtml);
        $(`.${selectedMessageType} > .screen-2`).toggle(isPdf);
        $(`.${selectedMessageType} > .screen-3`).toggle(isExtTemp);

        createContact();
        connection.trigger('nextStep');
      } else {
        handleValidationFailure();
      }
      break;

    case 'step3':
      prepopulateToDeMapping();
      $('#dropdown-options').hide();
      validateStep3()
        .then((isValid) => {
          isValid ? proceedToNext() : handleValidationFailure();
          resetToContactMappingErrors();
        })
        .catch(() => {
          handleValidationFailure();
        });
      break;

    case 'step4':
      if (validateToContact()) {
        let selectedSenderContactType = $('input[name="senderContactType"]:checked').val().replace(/\s+/g, '');
        if(selectedSenderContactType === 'create-contact') {
          createContact(true).then(()=>{
            getPreviewURL();
          })
            .catch(error => {
              $('.error-toast-message').text(error.message);
              $('.error-toast-wrap').addClass('show');
            });
        } else {
          getPreviewURL();
        }
      } else {
        handleValidationFailure();
      }
      break;

    case 'step5':
      save();
      break;

    default:
      connection.trigger('nextStep');
    }
  }

  function proceedToNext() {
    setPreviewPayload();
    connection.trigger('nextStep');
  }

  function onClickedBack() {
    connection.trigger('prevStep');
  }

  function onGotoStep(step) {
    showStep(step);
    connection.trigger('ready');
  }

  function showStep(step) {
    currentStep = step;
    $('.step').hide();
    switch (currentStep.key) {
    case 'step1':
      $('#step1').show();
      connection.trigger('updateButton', {
        button: 'back',
        visible: false,
      });
      break;
    case 'step2':
      $('#step2').show();
      connection.trigger('updateButton', {
        button: 'back',
        visible: true,
      });
      connection.trigger('updateButton', {
        button: 'next',
        text: 'next',
        visible: true,
      });
      break;
    case 'step3':
      $('#step3').show();
      connection.trigger('updateButton', {
        button: 'back',
        visible: true,
      });
      connection.trigger('updateButton', {
        button: 'next',
        text: 'next',
        visible: true,
      });
      break;
    case 'step4':
      $('#step4').show();
      connection.trigger('updateButton', {
        button: 'back',
        visible: true,
      });
      connection.trigger('updateButton', {
        button: 'next',
        text: 'next',
        visible: true,
      });
      break;
    case 'step5':
      $('#step5').show();
      connection.trigger('updateButton', {
        button: 'back',
        visible: true,
      });
      connection.trigger('updateButton', {
        button: 'next',
        text: 'done',
        visible: true,
      });
      break;
    }
  }

  async function save() {
    let isCartInsertEnabled = $('#card-insert').prop('checked');
    let selectedCardInsertDesignFormat = $('input[name=\'cardInsertType\']:checked').val().replace(/\s+/g, '');
    let selectedCardInsertType;
    if(isCartInsertEnabled){
      selectedCardInsertType = $('input[name="cardType"]:checked').val();
      previewPayload.cardInsertObj = {
        cardInsertEnabled : true,
        cardInsertDesignFormat : selectedCardInsertDesignFormat,
        cardInsertType : selectedCardInsertType
      };
    } else {
      previewPayload.cardInsertObj = null;
    }
    payload['arguments'].execute.inArguments = [{}];
    var MapDESchema = {};
    $('.mapping-fields-group select').each(function(){
      var eleID = $(this).attr('id');
      var optionSelect = $(this).find(':selected').val();
      if(optionSelect !== 'Select'){
        MapDESchema[eleID]='{{'+deData[optionSelect]+'}}';
      }
      previewDEMapOptions[eleID]=optionSelect;
    });

    var mergeVariableSchema = {};
    mergeVariablesFields.forEach(fieldName => {
      mergeVariableSchema[fieldName] = '{{'+deData[fieldName]+'}}';
    });

    let selectedMessageType = $('input[name="msgType"]:checked').val();
    if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    } else if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
      selectedMessageType = 'LettersCardInsert';
    }
    previewPayload.messageType = selectedMessageType;
    previewPayload.creationType = $('input[name=\'createType\']:checked').val();
    previewPayload.senderContactType = $('input[name=\'senderContactType\']:checked').val();
    payload['arguments'].execute.inArguments[0]['internalPostcardJson'] = previewPayload;
    payload['arguments'].execute.inArguments[0]['MapDESchema']=MapDESchema;
    payload['arguments'].execute.inArguments[0]['mergeVariableSchema']=mergeVariableSchema;
    payload['arguments'].execute.inArguments[0]['previewDEMapOptions']=previewDEMapOptions;
    payload['metaData'].isConfigured = true;
    var postCardJson = {
      from: previewPayload.fromContact ? previewPayload.fromContact.id : '',
      express: previewPayload.isExpressDelivery,
      description: previewPayload.description,
    };
    if(previewPayload.messageType !== 'Letters' && previewPayload.messageType !== 'LettersCardInsert') {
      postCardJson.size = previewPayload.size;
    }
    if(!previewPayload.isExpressDelivery) {
      postCardJson.mailingClass = previewPayload.mailingClass;
    }
    if(previewPayload.messageType === 'Postcards'){
      if(previewPayload.creationType === 'html-creation-type'){
        postCardJson.frontHTML = previewPayload.frontHtmlContent;
        postCardJson.backHTML = previewPayload.backHtmlContent;
      } else if(previewPayload.creationType === 'template-creation-type'){
        postCardJson.frontTemplate = previewPayload.frontTemplateId;
        postCardJson.backTemplate = previewPayload.backTemplateId;
      } else if(previewPayload.creationType === 'pdf-creation-type'){
        postCardJson.pdf = previewPayload.pdfLink;
      }
    } else if(previewPayload.messageType === 'selfmailer'){
      if(previewPayload.creationType === 'html-creation-type'){
        postCardJson.insideHTML = previewPayload.frontHtmlContent;
        postCardJson.outsideHTML = previewPayload.backHtmlContent;
      } else if(previewPayload.creationType === 'template-creation-type'){
        postCardJson.insideTemplate = previewPayload.frontTemplateId;
        postCardJson.outsideTemplate = previewPayload.backTemplateId;
      } else if(previewPayload.creationType === 'pdf-creation-type'){
        postCardJson.pdf = previewPayload.pdfLink;
      }
    } else if(previewPayload.messageType === 'trifold'){
      postCardJson.insideHTML = previewPayload.frontHtmlContent;
      postCardJson.outsideHTML = previewPayload.backHtmlContent;
      postCardJson.adhesiveInsert = postCardJson.adhesiveInsert || {}; 
      postCardJson.adhesiveInsert.size = previewPayload.cardInsertSize;  
      if(previewPayload.creationType === 'html-creation-type'){
        if(selectedCardInsertType === 'singleSide'){
          postCardJson.adhesiveInsert.singleSided = postCardJson.adhesiveInsert.singleSided || {};
          postCardJson.adhesiveInsert.singleSided.html = previewPayload.cardfrontHtmlContent;
        }
        else if(selectedCardInsertType === 'doubleSide'){
          postCardJson.adhesiveInsert.doubleSided = postCardJson.adhesiveInsert.doubleSided || {};
          postCardJson.adhesiveInsert.doubleSided.outsideHTML = previewPayload.cardbackHtmlContent;
          postCardJson.adhesiveInsert.doubleSided.insideHTML = previewPayload.cardfrontHtmlContent;;
        }
      }
      else if(previewPayload.creationType === 'pdf-creation-type'){
        postCardJson.adhesiveInsert.size = previewPayload.pdfCardSize;
        if(selectedCardInsertType === 'singleSide'){
          postCardJson.adhesiveInsert.singleSided = postCardJson.adhesiveInsert.singleSided || {};
          postCardJson.adhesiveInsert.singleSided.pdf = previewPayload.pdfLink;
        }
        else{
          postCardJson.adhesiveInsert.doubleSided = postCardJson.adhesiveInsert.doubleSided || {};
          postCardJson.adhesiveInsert.doubleSided.pdf = previewPayload.pdfLink;
        }
      }
    } else if(previewPayload.messageType === 'Letters'){
      if(previewPayload.extraService !== '' && previewPayload.extraService !== undefined && !previewPayload.isExpressDelivery) {
        postCardJson.extraService = previewPayload.extraService;
      }
      if(previewPayload.envelopeType !== '' && previewPayload.envelopeType !== undefined){
        postCardJson.envelopeType = previewPayload.envelopeType;
      }
      if(previewPayload.returnEnvelope !== '' && previewPayload.returnEnvelope !== undefined){
        postCardJson.returnEnvelope = previewPayload.returnEnvelope;
      }
      postCardJson.color = previewPayload.color;
      postCardJson.doubleSided = previewPayload.doubleSided;
      if (previewPayload.perforatedPage) {
        postCardJson.perforatedPage = 1;
      }
      if(previewPayload.addressPlacement === true) {
        postCardJson.addressPlacement = 'insert_blank_page';
      } else {
        postCardJson.addressPlacement = 'top_first_page';
      }
      if(previewPayload.creationType === 'html-creation-type'){
        postCardJson.html = previewPayload.frontHtmlContent;
      } else if(previewPayload.creationType === 'template-creation-type'){
        postCardJson.template = previewPayload.frontTemplateId;
      } else if(previewPayload.creationType === 'pdf-creation-type'){
        postCardJson.pdf = previewPayload.pdfLink;
      }
    } else if(previewPayload.messageType === 'LettersCardInsert'){
      postCardJson.plasticCard = postCardJson.plasticCard || {};
      postCardJson.plasticCard.size = previewPayload.plasticCardSize;
      if(previewPayload.extraService !== '' && previewPayload.extraService !== undefined && !previewPayload.isExpressDelivery) {
        postCardJson.extraService = previewPayload.extraService;
      }
      if(previewPayload.envelopeType !== '' && previewPayload.envelopeType !== undefined){
        postCardJson.envelopeType = previewPayload.envelopeType;
      }
      if(previewPayload.returnEnvelope !== '' && previewPayload.returnEnvelope !== undefined){
        postCardJson.returnEnvelope = previewPayload.returnEnvelope;
      }
      postCardJson.color = previewPayload.color;
      postCardJson.doubleSided = previewPayload.doubleSided;
      if (previewPayload.perforatedPage) {
        postCardJson.perforatedPage = 1;
      }
      if(previewPayload.addressPlacement === true) {
        postCardJson.addressPlacement = 'insert_blank_page';
      } else {
        postCardJson.addressPlacement = 'top_first_page';
      }
      if(selectedCardInsertType === 'singleSide'){
        postCardJson.plasticCard.singleSided = postCardJson.plasticCard.singleSided || {};
        if(previewPayload.creationType === 'html-creation-type'){
          postCardJson.html = previewPayload.frontHtmlContent;
          if(selectedCardInsertDesignFormat === 'pdf'){
            postCardJson.plasticCard.singleSided.pdf = previewPayload.cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template'){
            postCardJson.plasticCard.singleSided.template = previewPayload.frontTemplateId;
          } else {            
            postCardJson.plasticCard.singleSided.html = previewPayload.cardfrontHtmlContent;
          }
        } else if(previewPayload.creationType === 'template-creation-type'){
          postCardJson.template = previewPayload.frontTemplateId;
          if(selectedCardInsertDesignFormat === 'pdf'){
            postCardJson.plasticCard.singleSided.pdf = previewPayload.cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template'){
            postCardJson.plasticCard.singleSided.template = previewPayload.cardFrontTemplateId;
          } else {            
            postCardJson.plasticCard.singleSided.html = previewPayload.cardfrontHtmlContent;
          }
        } else if(previewPayload.creationType === 'pdf-creation-type'){
          postCardJson.pdf = previewPayload.pdfLink;
          if(selectedCardInsertDesignFormat === 'pdf'){
            postCardJson.plasticCard.singleSided.pdf = previewPayload.cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template'){
            postCardJson.plasticCard.singleSided.template = previewPayload.cardFrontTemplateId;
          } else {            
            postCardJson.plasticCard.singleSided.html = previewPayload.cardfrontHtmlContent;
          }
        }
      } else if(selectedCardInsertType === 'doubleSide'){      
        postCardJson.plasticCard.doubleSided = postCardJson.plasticCard.doubleSided || {};
        if(previewPayload.creationType === 'html-creation-type'){
          postCardJson.html = previewPayload.frontHtmlContent;
          if(selectedCardInsertDesignFormat === 'pdf'){
            postCardJson.plasticCard.doubleSided.pdf = previewPayload.cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template'){
            postCardJson.plasticCard.doubleSided.frontTemplate = previewPayload.cardFrontTemplateId;
            postCardJson.plasticCard.doubleSided.backTemplate = previewPayload.cardBackTemplateId;
          } else {            
            postCardJson.plasticCard.doubleSided.frontHTML = previewPayload.cardfrontHtmlContent;
            postCardJson.plasticCard.doubleSided.backHTML = previewPayload.cardbackHtmlContent;
          }
        } else if(previewPayload.creationType === 'template-creation-type'){
          postCardJson.template = previewPayload.frontTemplateId;
          if(selectedCardInsertDesignFormat === 'pdf'){
            postCardJson.plasticCard.doubleSided.pdf = previewPayload.cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template'){
            postCardJson.plasticCard.doubleSided.frontTemplate = previewPayload.cardFrontTemplateId;
            postCardJson.plasticCard.doubleSided.backTemplate = previewPayload.cardBackTemplateId;
          } else {            
            postCardJson.plasticCard.doubleSided.frontHTML = previewPayload.cardfrontHtmlContent;
            postCardJson.plasticCard.doubleSided.backHTML = previewPayload.cardbackHtmlContent;
          }
        } else if(previewPayload.creationType === 'pdf-creation-type'){
          postCardJson.pdf = previewPayload.pdfLink;
          if(selectedCardInsertDesignFormat === 'pdf'){
            postCardJson.plasticCard.doubleSided.pdf = previewPayload.cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template'){
            postCardJson.plasticCard.doubleSided.frontTemplate = previewPayload.cardFrontTemplateId;
            postCardJson.plasticCard.doubleSided.backTemplate = previewPayload.cardBackTemplateId;
          } else {            
            postCardJson.plasticCard.doubleSided.frontHTML = previewPayload.cardfrontHtmlContent;
            postCardJson.plasticCard.doubleSided.backHTML = previewPayload.cardbackHtmlContent;
          }
        }
      } 
    }
    
    payload['arguments'].execute.inArguments[0]['postcardJson'] = postCardJson;
    authorization['authToken'] = authToken;
    authorization['et_subdomain'] = et_subdomain;
    authorization['authTSSD'] = authTSSD;
    
    payload['arguments'].execute.inArguments[0]['authorization'] = authorization;
    connection.trigger('updateActivity', payload);
  }

  function initializeHandler() {
    executeScreenTwoMethods();
  }

  function handleValidationFailure() {
    showStep(currentStep);
    connection.trigger('ready');
  }

  function toggleApiKeyVisibility(e) {
    e.preventDefault();
    const input = $(this).prev('input');
    const icon = $(this).find('i');
  
    input.attr('type', input.attr('type') === 'text' ? 'password' : 'text');
    icon.toggleClass('fa-eye fa-eye-slash');
  }

  function validateApiKeys() {
    let isValid = true;
    const testApiKey = $('#test-api-key').val().trim();
    const liveApiKey = $('#live-api-key').val().trim();
    const regexForTestApiKey = /^test_sk_[a-zA-Z0-9]{16,}$/;
    const regexForLiveApiKey = /^live_sk_[a-zA-Z0-9]{16,}$/;

    if (testApiKey === '') {
      $('#test-api-key').css('border', '1px solid red');
      $('#test-api-key-error').text('Missing or invalid authentication').show();
      isValid = false;
    } else if (!regexForTestApiKey.test(testApiKey)) {
      $('#test-api-key').css('border', '1px solid red');
      $('#test-api-key-error').text(`Invalid API key: ${testApiKey}`).show();
      isValid = false;
    } else {
      previewPayload.test_api_key = testApiKey;
      $('#test-api-key-error').hide();
      $('#test-api-key').css('border', '');
    }

    previewPayload.live_api_key = liveApiKey;
    if (liveApiKey !== '') {
      if (!regexForLiveApiKey.test(liveApiKey)) {
        $('#live-api-key').css('border', '1px solid red');
        $('#live-api-key-error').text(`Invalid API key: ${liveApiKey}`).show();
        isValid = false;
        previewPayload.live_api_key = '';
      }
    }
    return isValid;
  }
  
  function hideError() {
    $(this).css('border', '').siblings('.error-message').hide();
  }

  function validateStep2() {
    let isValid = true;
    let errorMessages = [];

    if (!$('input[name=\'msgType\']:checked').length) {
      errorMessages.push('Message Type is required.');
      isValid = false;
      $('#msgType-error').text('Message Type is required.');
    } else {
      $('#msgType-error').text('');
    }

    if (!$('input[name=\'createType\']:checked').length) {
      errorMessages.push('Creation Type is required.');
      isValid = false;
      $('#createType-error').text('Creation Type is required.');
    } else {
      $('#createType-error').text(''); 
    }

    if (!errorMessages.length) {
      $('#step2-error').hide();
    } else {
      $('#step2-error').html(errorMessages.join('<br>')).show();
    }

    return isValid;
  }

  function handleApiKeyToggle() {
    if (typeof previewPayload === 'undefined') {
      return;
    }

    const testApiKey = previewPayload.test_api_key || '';
    const liveApiKey = previewPayload.live_api_key || '';
    const $liveModeToggle = $('.test-to-live-switch input');

    if ($liveModeToggle.length === 0) {
      return;
    }

    if (testApiKey && !liveApiKey) {
      previewPayload.liveApiKeyEnabled = false;
      $liveModeToggle.prop('disabled', true).prop('checked', false);
    } else {
      $liveModeToggle.prop('disabled', false);
    }
  }

  function executeScreenTwoMethods() {
    $('input[name="msgType"]').change(function () {
      if (this.id === 'letters') {
        $('#card-insert-container').addClass('visible');
        $('.card-insert-wrapper').addClass('visible');
      } else {
        $('#card-insert-container').removeClass('visible');
        $('.card-insert-wrapper').removeClass('visible');
      }
      $('#card-insert').prop('checked', false).trigger('change');
    });

    $('#card-insert').change(function () {
      if (this.checked) {
        $('#card-insert-type').removeClass('hidden');
        $('.card-insert-creation-type-wrapper').removeClass('hidden');
        let selectedMessageType = $('input[name="msgType"]:checked').val();
        if(selectedMessageType === 'selfmailer') {
          $('#extTempId').css('display','none');
          $('label[for="extTempId"]').css('display','none');
          $('#extTempId').prop('checked', false);
        }
        $('#single-sided').prop('checked', true);
        $('#card-insert-html').prop('checked', true);
      } else {
        $('#card-insert-type').addClass('hidden');
        $('.card-insert-creation-type-wrapper').addClass('hidden');
        $('#extTempId').css('display','block');
        $('label[for="extTempId"]').css('display','block');
      }
    });
  }

  function setDefaultValuesForPostCardCreation() {
    let isCartInsertEnabled = $('#card-insert').prop('checked');
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
    let selectedCreationType = $('input[name=\'createType\']:checked').val().replace(/\s+/g, '');
    if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    } else if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
      selectedMessageType = 'LettersCardInsert';
    }
    $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-btn-front`).click(function () {
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .btn-light`).removeClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-area`).removeClass('show');
      $(this).addClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front`).addClass('show');
    });
    $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-btn-back`).click(function () {  
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .btn-light`).removeClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-area`).removeClass('show');
      $(this).addClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back`).addClass('show');
    });
    $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-btn-card-front`).click(function () {  
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .btn-light`).removeClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-area`).removeClass('show');
      $(this).addClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).addClass('show');
    });
    $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-btn-card-back`).click(function () {  
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .btn-light`).removeClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor .html-area`).removeClass('show');
      $(this).addClass('show');
      $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back-card-insert`).addClass('show');
    });

    $('input[name="cardType"]').change(function() {
      let containerSelector = `.${selectedMessageType} .spacer.${selectedCreationType}`;
      $(`${containerSelector} input[type="text"]`).val('');
      $(`${containerSelector} select`).prop('selectedIndex', 0);
      $(`${containerSelector} input[type="radio"]`).prop('checked', false);
      $(`${containerSelector} textarea`).val('');
      $(`${containerSelector} .size-radio-label .radio-input`).first().prop('checked', true);
    });
  }

  function resetContactFields() {
    $('.contact-dropdown-container #search-contact').val('');
    $('#newContactFirstName').val('').trigger('input');
    $('#newContactLastName').val('');
    $('#newContactCompanyName').val('').trigger('input');
    $('#newContactEmail').val('');
    $('#newContactAddressLine1').val('');
    $('#newContactAddressLine2').val('');
    $('#newContactCity').val('');
    $('#newContactState').val('');
    $('#newContactCountryCode').val('');
    $('#newContactPostal').val('');
  }

  async function validateStep3() {
    let selectedCardInsertType;
    let isValid = true;
    let isCartInsertEnabled = $('#card-insert').prop('checked');
    let selectedCardInsertDesignFormat = $('input[name=\'cardInsertType\']:checked').val().replace(/\s+/g, '');
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');

    if(isCartInsertEnabled){
      selectedCardInsertType = $('input[name="cardType"]:checked').val();
    }
    
    if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    } else if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
      selectedMessageType = 'LettersCardInsert';
    }

    if ($(`.${selectedMessageType} .screen-1`).css('display') === 'block') {
      let isDescriptionValid = validateInputField($(`.${selectedMessageType} .screen-1 .description`));
      if (!isDescriptionValid) {
        isValid = false;
      }

      let postcardHtmlEditorErrorMsg = $(`.${selectedMessageType} .screen-1 .html-editor .error-msg`);
      let isPostcardSizeSelected = $(`.${selectedMessageType} .screen-1 .html-size .radio-input:checked`).length;
      let frontHtmlContent = $(`.${selectedMessageType} .screen-1 .html-editor-front`).val().trim();
      let frontHtmlBtnLabel = $(`.${selectedMessageType} .screen-1 .html-editor-front`).data('btn-label');
      let backHtmlContent = $(`.${selectedMessageType} .screen-1 .html-editor-back`).val() === undefined ? undefined : $(`.${selectedMessageType} .screen-1 .html-editor-back`).val().trim();
      let backHtmlBtnLabel = $(`.${selectedMessageType} .screen-1 .html-editor-back`).val() === undefined ? undefined : $(`.${selectedMessageType} .screen-1 .html-editor-back`).data('btn-label');
      let cardfrontHtmlContent, cardfrontHtmlBtnLabel, cardbackHtmlContent, cardbackHtmlBtnLabel;

      if(isCartInsertEnabled && selectedCardInsertType === 'doubleSide') {
        let cardfrontHtmlElement = $(`.${selectedMessageType} .screen-1 .html-editor-front-card-insert`);
        let cardbackHtmlElement = $(`.${selectedMessageType} .screen-1 .html-editor-back-card-insert`);
        cardfrontHtmlContent = cardfrontHtmlElement === undefined || cardfrontHtmlElement.hasClass('hidden') ? undefined : cardfrontHtmlElement.val().trim();
        cardfrontHtmlBtnLabel = cardfrontHtmlElement === undefined || cardfrontHtmlElement.hasClass('hidden') ? undefined : cardfrontHtmlElement.data('btn-label');
        cardbackHtmlContent = cardbackHtmlElement === undefined || cardbackHtmlElement.hasClass('hidden') ? undefined : cardbackHtmlElement.val().trim();
        cardbackHtmlBtnLabel = cardbackHtmlElement === undefined || cardbackHtmlElement.hasClass('hidden') ? undefined : cardbackHtmlElement.data('btn-label');  

        if (frontHtmlContent === '' || backHtmlContent === '' || cardfrontHtmlContent === '' || cardbackHtmlContent === '') {
          isValid = false;

          if (cardfrontHtmlContent === '' && cardbackHtmlContent === '' && frontHtmlContent === '' && backHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}, ${backHtmlBtnLabel}, ${cardfrontHtmlBtnLabel}, ${cardbackHtmlBtnLabel}.`).addClass('show');
          } else {
            let missingFields = [];
            if (frontHtmlContent === '') {missingFields.push(frontHtmlBtnLabel);}
            if (backHtmlContent === '') {missingFields.push(backHtmlBtnLabel);}
            if (cardfrontHtmlContent === '') {missingFields.push(cardfrontHtmlBtnLabel);}
            if (cardbackHtmlContent === '') {missingFields.push(cardbackHtmlBtnLabel);}

            if (missingFields.length > 0) {
              postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${missingFields.join(', ')}.`).addClass('show');
            }
          }
        } else { 
          postcardHtmlEditorErrorMsg.removeClass('show');
        }        
      } else if(isCartInsertEnabled && selectedCardInsertType === 'singleSide') {
        let cardfrontHtmlElement = $(`.${selectedMessageType} .screen-1 .html-editor-front-card-insert`);
        cardfrontHtmlContent = cardfrontHtmlElement.val() === undefined || cardfrontHtmlElement.hasClass('hidden') ? undefined : cardfrontHtmlElement.val().trim();
        cardfrontHtmlBtnLabel = cardfrontHtmlElement.val() === undefined || cardfrontHtmlElement.hasClass('hidden') ? undefined : cardfrontHtmlElement.data('btn-label');

        if (frontHtmlContent === '' || backHtmlContent === '' || cardfrontHtmlContent === '') {
          isValid = false;
          if (frontHtmlContent === '' && backHtmlContent === '' && cardfrontHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}, ${backHtmlBtnLabel}, ${cardfrontHtmlBtnLabel}.`).addClass('show');
          } else {
            let missingFields = [];
            if (frontHtmlContent === '') {missingFields.push(frontHtmlBtnLabel);}
            if (backHtmlContent === '') {missingFields.push(backHtmlBtnLabel);}
            if (cardfrontHtmlContent === '') {missingFields.push(cardfrontHtmlBtnLabel);}

            if (missingFields.length > 0) {
              postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${missingFields.join(', ')}.`).addClass('show');
            }
          }
        } else { 
          postcardHtmlEditorErrorMsg.removeClass('show');
        }
      } else if(selectedMessageType === 'Letters') { 
        if(frontHtmlContent === '') {
          isValid = false;
          postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}.`).addClass('show');
        } else { 
          postcardHtmlEditorErrorMsg.removeClass('show');
        }
      } else{
        if (frontHtmlContent === '' || backHtmlContent === '') {
          isValid = false;
          if (frontHtmlContent === '' && backHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}, ${backHtmlBtnLabel}.`).addClass('show');
          } else if (frontHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}.`).addClass('show');
          } else {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${backHtmlBtnLabel}.`).addClass('show');
          }
        } else { 
          postcardHtmlEditorErrorMsg.removeClass('show');
        }
      }

      if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert'){
        if (!(isPostcardSizeSelected > 0)) {
          $(`.${selectedMessageType} .html-size .error-msg`).addClass('show');
          isValid = false;
        } else {
          $(`.${selectedMessageType} .html-size .error-msg`).removeClass('show');
        }
      }

      if(selectedMessageType === 'LettersCardInsert' && selectedCardInsertDesignFormat !== 'html') {
        let isValidInput = validateInputField($(`.${selectedMessageType} .screen-1 .card-insert-input-${selectedCardInsertDesignFormat} input`));
        if(!isValidInput) {
          isValid = false;
        }

        if(selectedCardInsertType === 'doubleSide') {
          const doubleSideInputElement = $(`.${selectedMessageType} .screen-1 .card-insert-input-${selectedCardInsertDesignFormat}-${selectedCardInsertType} input`);
          if(doubleSideInputElement.length > 0 && !doubleSideInputElement.hasClass('hidden')) {
            if(!validateInputField(doubleSideInputElement)) {
              isValid = false;
            }
          }
        }
      }
    };
    
    if ($(`.${selectedMessageType} .screen-2`).css('display') === 'block') {
      const pdfLinkElement = $(`.${selectedMessageType} .screen-2 .pdfLink`);
      let isDescriptionValid = validateInputField($(`.${selectedMessageType} .screen-2 .description`));
      pdfLinkElement.siblings('.error-msg').text('Please enter required field');
      let isPdfLinkValid = validateInputField(pdfLinkElement);
      
      if (!isDescriptionValid || !isPdfLinkValid) {
        isValid = false;
      }
  
      if (selectedMessageType === 'trifold') {
        let frontHtmlContent = $(`.${selectedMessageType} .screen-2 .html-editor-front`).val().trim();
        let frontHtmlBtnLabel = $(`.${selectedMessageType} .screen-2 .html-editor-front`).data('btn-label');
        let backHtmlContent = $(`.${selectedMessageType} .screen-2 .html-editor-back`).val().trim();
        let backHtmlBtnLabel = $(`.${selectedMessageType} .screen-2 .html-editor-back`).data('btn-label');
        let postcardHtmlEditorErrorMsg = $(`.${selectedMessageType} .screen-2 .html-editor .error-msg`);
  
        if (frontHtmlContent === '' || backHtmlContent === '') {
          isValid = false;
          if (frontHtmlContent === '' && backHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}, ${backHtmlBtnLabel}.`).addClass('show');
          } else if (frontHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}.`).addClass('show');
          } else {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${backHtmlBtnLabel}.`).addClass('show');
          }
        } else { 
          postcardHtmlEditorErrorMsg.removeClass('show');
        }
      }

      if(selectedMessageType === 'LettersCardInsert') {
        if(selectedCardInsertDesignFormat === 'html') {
          let cardfrontHtmlContent = $(`.${selectedMessageType} .screen-2 .html-editor-front-card-insert`).val().trim();
          let cardfrontHtmlBtnLabel = $(`.${selectedMessageType} .screen-2 .html-editor-front-card-insert`).data('btn-label');
          let cardBackHtmlElement = $(`.${selectedMessageType} .screen-2 .html-editor-back-card-insert`);
          let cardBackHtmlContent = cardBackHtmlElement.val() === undefined || cardBackHtmlElement.hasClass('hidden') ? undefined : cardBackHtmlElement.val().trim();
          let cardBackHtmlBtnLabel = cardBackHtmlElement.val() === undefined || cardBackHtmlElement.hasClass('hidden') ? undefined : cardBackHtmlElement.data('btn-label');
          let htmlEditorErrorMsg = $(`.${selectedMessageType} .screen-2 .html-editor .error-msg`);

          if (cardfrontHtmlContent === '' || cardBackHtmlContent === '') {
            isValid = false;
            let missingFields = [];
            if (cardfrontHtmlContent === '') {missingFields.push(cardfrontHtmlBtnLabel);}
            if (cardBackHtmlContent === '') {missingFields.push(cardBackHtmlBtnLabel);}

            if (missingFields.length > 0) {
              htmlEditorErrorMsg.text(`Please enter content in the following fields: ${missingFields.join(', ')}.`).addClass('show');
            }
          } else { 
            htmlEditorErrorMsg.removeClass('show');
          }
        } else {
          let isValidInput = validateInputField($(`.${selectedMessageType} .screen-2 .card-insert-input-${selectedCardInsertDesignFormat} input`));
          if(!isValidInput) {
            isValid = false;
          }

          if(selectedCardInsertType === 'doubleSide') {
            const doubleSideInputElement = $(`.${selectedMessageType} .screen-2 .card-insert-input-${selectedCardInsertDesignFormat}-${selectedCardInsertType} input`);
            if(doubleSideInputElement.length > 0 && !doubleSideInputElement.hasClass('hidden')) {
              if(!validateInputField(doubleSideInputElement)) {
                isValid = false;
              }
            }
          }
        }
      }
    }

    if ($(`.${selectedMessageType} .screen-3`).css('display') === 'block'){
      let isDescriptionValid = validateInputField($(`.${selectedMessageType} .screen-3 .description`));
      if (!isDescriptionValid) {
        isValid = false;
      }
      if (selectedMessageType === 'trifold') {
        let frontHtmlContent = $(`.${selectedMessageType} .screen-3 .html-editor-front`).val().trim();
        let frontHtmlBtnLabel = $(`.${selectedMessageType} .screen-3 .html-editor-front`).data('btn-label');
        let backHtmlContent = $(`.${selectedMessageType} .screen-3 .html-editor-back`).val().trim();
        let backHtmlBtnLabel = $(`.${selectedMessageType} .screen-3 .html-editor-back`).data('btn-label');
        let postcardHtmlEditorErrorMsg = $(`.${selectedMessageType} .screen-3 .html-editor .error-msg`);

        if (frontHtmlContent === '' || backHtmlContent === '') {
          isValid = false;
          if (frontHtmlContent === '' && backHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}, ${backHtmlBtnLabel}.`).addClass('show');
          } else if (frontHtmlContent === '') {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${frontHtmlBtnLabel}.`).addClass('show');
          } else {
            postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${backHtmlBtnLabel}.`).addClass('show');
          }
        } else { 
          postcardHtmlEditorErrorMsg.removeClass('show');
        }
      }
      if(selectedMessageType === 'trifold' && selectedCardInsertType === 'singleSide'){
        let singleSideTemplate = validateInputField($(`.${selectedMessageType} .screen-3 .singleSideTemplate`));
        if(!singleSideTemplate){
          isValid = false;
        }
      } else {
        let frontTemplateValid = validateInputField($(`.${selectedMessageType} .screen-3 .frontTemplate`));
        let backTemplateValid;
        if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert' ) {
          backTemplateValid = validateInputField($(`.${selectedMessageType} .screen-3 .backTemplate`));
        } else {
          backTemplateValid = true;
        }
        if(!frontTemplateValid || !backTemplateValid){
          isValid = false;
        }
      }
      if(selectedMessageType === 'LettersCardInsert'){
        let postcardHtmlEditorErrorMsg = $(`.${selectedMessageType} .screen-3 .html-editor .error-msg`);
        if(selectedCardInsertDesignFormat === 'html') {
          const cardfrontHtmlContent = $(`.${selectedMessageType} .screen-3 .html-editor-front-card-insert`).val().trim();
          const cardfrontHtmlBtnLabel = $(`.${selectedMessageType} .screen-3 .html-editor-front-card-insert`).data('btn-label');
          const cardBackHtmlElement = $(`.${selectedMessageType} .screen-3 .html-editor-back-card-insert`);
          const cardbackHtmlContent = cardBackHtmlElement.hasClass('hidden') ? undefined : cardBackHtmlElement.val().trim();
          const cardbackHtmlBtnLabel = cardBackHtmlElement.hasClass('hidden') ? undefined : cardBackHtmlElement.data('btn-label'); 

          if (cardfrontHtmlContent === '' || cardbackHtmlContent === '') {
            isValid = false;
            let missingFields = [];
            if (cardfrontHtmlContent === '') {missingFields.push(cardfrontHtmlBtnLabel);}
            if (cardbackHtmlContent === '') {missingFields.push(cardbackHtmlBtnLabel);}
            if (missingFields.length > 0) {
              if(selectedCardInsertType === 'singleSide'){
                postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${cardfrontHtmlBtnLabel}.`).addClass('show');
              } else{
                postcardHtmlEditorErrorMsg.text(`Please enter content in the following fields: ${missingFields.join(', ')}.`).addClass('show');
              }
            }
          } else { 
            postcardHtmlEditorErrorMsg.removeClass('show');
          }
        }

        if(selectedCardInsertDesignFormat !== 'html') {
          const isValidInput = validateInputField($(`.${selectedMessageType} .screen-3 .card-insert-input-${selectedCardInsertDesignFormat} input`));
          if (!isValidInput) {
            isValid = false;
          }

          if(selectedCardInsertType === 'doubleSide') {
            const doubleSideInputElement = $(`.${selectedMessageType} .screen-3 .card-insert-input-${selectedCardInsertDesignFormat}-${selectedCardInsertType} input`);
            if(doubleSideInputElement.length > 0 && !doubleSideInputElement.hasClass('hidden')) {
              if(!validateInputField(doubleSideInputElement)) {
                isValid = false;
              }
            }
          }
          
        }
      }
    }

    return isValid;
  }

  function validateInputField(element) {
    if (element.val().trim() === '') {
      element.addClass('error');
      element.siblings('.error-msg').addClass('show');
      return false;
    } else {
      element.removeClass('error');
      element.siblings('.error-msg').removeClass('show');
      return true;
    }
  }

  function setPreviewPayload() {
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
    let selectedCardInsertDesignFormat = $('input[name=\'cardInsertType\']:checked').val().replace(/\s+/g, '');
    let selectedPlasticCardSize = $(`input[name=\'${selectedCardInsertDesignFormat}-plastic-card-size\']:checked`).val().replace(/\s+/g, '');
    let isCartInsertEnabled = $('#card-insert').prop('checked');

    if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    } else if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
      selectedMessageType = 'LettersCardInsert';
    }
    let selectedCreationType = $('input[name=\'createType\']:checked').val().replace(/\s+/g, '');
    let isTrifoldEnabled = selectedMessageType === 'trifold';

    let selectedCardInsertType;
    if(isCartInsertEnabled){
      selectedCardInsertType = $('input[name="cardType"]:checked').val();
    }

    if(selectedMessageType === 'Letters' || selectedMessageType === 'LettersCardInsert') {
      let extraService = $(`.${selectedMessageType} .${selectedCreationType} .extra-service`).attr('data-id');
      let extraServiceName = $(`.${selectedMessageType} .${selectedCreationType} .extra-service`).val();
      let envelopeType = $(`.${selectedMessageType} .${selectedCreationType} .envelope-type`).attr('data-id');
      let envelopeTypeName = $(`.${selectedMessageType} .${selectedCreationType} .envelope-type`).val();
      let returnEnvelope = $(`.${selectedMessageType} .${selectedCreationType} .returnEnvelope`).attr('data-id');
      let returnEnvelopeName = $(`.${selectedMessageType} .${selectedCreationType} .returnEnvelope`).val();
      let colorInput = $(`.${selectedMessageType} .${selectedCreationType} .color-input`).is(':checked');
      let perforateFirstPageInput = $(`.${selectedMessageType} .${selectedCreationType} .preforate-first-page-input`).is(':checked');
      let doubleSidedInput = $(`.${selectedMessageType} .${selectedCreationType} .double-sided-input`).is(':checked');
      let insertBlankPageInput = $(`.${selectedMessageType} .${selectedCreationType} .insert-blank-page-input`).is(':checked');

      previewPayload.extraService = extraService;
      previewPayload.extraServiceName = extraServiceName;
      previewPayload.envelopeType = envelopeType;
      previewPayload.envelopeTypeName = envelopeTypeName;
      previewPayload.returnEnvelope = returnEnvelope;
      previewPayload.returnEnvelopeName = returnEnvelopeName;
      previewPayload.color = colorInput;
      previewPayload.perforatedPage = perforateFirstPageInput;
      previewPayload.doubleSided = doubleSidedInput;
      previewPayload.addressPlacement = insertBlankPageInput;
    }

    if ($(`.${selectedMessageType} .screen-1`).css('display') === 'block') {
      const description = $(`.${selectedMessageType} .${selectedCreationType} .description`).val();
      const mailingClass = $(`.${selectedMessageType} .${selectedCreationType} .mailing-class`).val();
      const frontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front`).val();
      const isExpressDelivery = $(`.${selectedMessageType} .${selectedCreationType} .express-delivery-input`).is(':checked');
      let backHtmlContent;
      let size;

      previewPayload.screen = 'html';
      previewPayload.description = description;
      previewPayload.mailingClass = mailingClass;
      previewPayload.frontHtmlContent = frontHtmlContent;
      previewPayload.isExpressDelivery = isExpressDelivery;

      if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert') {
        backHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back`).val();
        size = $(`.${selectedMessageType} .${selectedCreationType} .html-size .radio-input:checked`).val();
        previewPayload.backHtmlContent = backHtmlContent;
        previewPayload.size = size;
      }

      if(isCartInsertEnabled && selectedCardInsertType === 'doubleSide'){
        const cardfrontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).val().trim();
        const cardbackHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back-card-insert`).val().trim();
        
        if(selectedMessageType === 'LettersCardInsert') {
          const frontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front`).val();
          previewPayload.frontHtmlContent = frontHtmlContent;
          previewPayload.plasticCardSize = selectedPlasticCardSize;
          if(selectedCardInsertDesignFormat === 'pdf') {
            const cardPdfLink = $(`.${selectedMessageType} .${selectedCreationType} .cardPdfLink`).val().trim();
            previewPayload.cardPdfLink = cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template') {
            const cardFrontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`) ?.attr('data-id');
            const cardFrontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`).val();
            const cardBackTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-back-template`) ?.attr('data-id');
            const cardBackTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-back-template`).val();
            previewPayload.cardFrontTemplateId = cardFrontTemplateId;
            previewPayload.cardFrontTemplateName = cardFrontTemplateName;
            previewPayload.cardBackTemplateId = cardBackTemplateId;
            previewPayload.cardBackTemplateName = cardBackTemplateName;
          } else {
            previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
            previewPayload.cardbackHtmlContent = cardbackHtmlContent;
          }
        } else{
          const cardInsertSize = $(`.${selectedMessageType} .${selectedCreationType} .html-card-size .radio-input:checked`).val();
          previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
          previewPayload.cardbackHtmlContent = cardbackHtmlContent;
          previewPayload.cardSize = cardInsertSize;
        }
      }else if(isCartInsertEnabled && selectedCardInsertType === 'singleSide'){
        if(selectedCardInsertDesignFormat !== 'pdf' && selectedCardInsertDesignFormat !== 'template') {
          const cardfrontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).val().trim();
          previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
        }
        if(selectedMessageType === 'LettersCardInsert') {
          previewPayload.plasticCardSize = selectedPlasticCardSize;
          if(selectedCardInsertDesignFormat === 'pdf') {
            const cardPdfLink = $(`.${selectedMessageType} .${selectedCreationType} .cardPdfLink`).val().trim();
            previewPayload.cardPdfLink = cardPdfLink;
          } else if(selectedCardInsertDesignFormat === 'template') {
            const frontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .frontTemplate`) ?.attr('data-id');
            const frontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .frontTemplate`).val();
            previewPayload.frontTemplateId = frontTemplateId;
            previewPayload.frontTemplateName = frontTemplateName;
          }
        } else {
          const cardInsertSize = $(`.${selectedMessageType} .html-card-size .radio-input:checked`).val();
          previewPayload.cardSize = cardInsertSize;
        }
      }
    } else if ($(`.${selectedMessageType} .screen-2`).css('display') === 'block') {
      const description = $(`.${selectedMessageType} .${selectedCreationType} .description`).val();;
      const mailingClass = $(`.${selectedMessageType} .${selectedCreationType} .mailing-class`).val();

      previewPayload.screen = 'pdf';
      previewPayload.description = description;
      previewPayload.mailingClass = mailingClass;
      previewPayload.plasticCardSize = selectedPlasticCardSize;

      if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert') {
        const size = $(`.${selectedMessageType} .pdf-size .radio-input:checked`).val();
        previewPayload.size = size;
      }

      if(isTrifoldEnabled) {
        const pdfLink = $(`.${selectedMessageType} .${selectedCreationType} .pdfLink`).val();
        const pdfCardSize = $(`.${selectedMessageType} .${selectedCreationType} .pdf-card-size .radio-input:checked`).val();
        const frontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front`).val();
        const backHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back`).val();

        previewPayload.pdfLinkInput = pdfLink;
        previewPayload.cardSize = pdfCardSize;
        previewPayload.frontHtmlContent = frontHtmlContent;
        previewPayload.backHtmlContent = backHtmlContent;
      } else {
        const isExpressDelivery = $(`.${selectedMessageType} .${selectedCreationType} .express-delivery-input`).is(':checked');
        const pdfLink = $(`.${selectedMessageType} .${selectedCreationType} .pdfLink`).val().trim();
        previewPayload.isExpressDelivery = isExpressDelivery;
        previewPayload.pdf = pdfLink;
      }

      if(isCartInsertEnabled && selectedMessageType === 'LettersCardInsert' && selectedCardInsertType === 'singleSide') {
        if(selectedCardInsertDesignFormat === 'pdf') {
          let cardPdfLink = $(`.${selectedMessageType} .${selectedCreationType} .cardPdfLink`).val().trim();
          previewPayload.cardPdfLink = cardPdfLink;
        } else if(selectedCardInsertDesignFormat === 'template') {
          const cardFrontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`) ?.attr('data-id');
          const cardFrontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`).val();
          previewPayload.cardFrontTemplateId = cardFrontTemplateId;
          previewPayload.cardFrontTemplateName = cardFrontTemplateName;
        } else {
          const cardfrontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).val().trim();
          previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
        }
      } else if(isCartInsertEnabled && selectedMessageType === 'LettersCardInsert' && selectedCardInsertType === 'doubleSide') {
        if(selectedCardInsertDesignFormat === 'pdf') {
          let cardPdfLink = $(`.${selectedMessageType} .${selectedCreationType} .cardPdfLink`).val().trim();
          previewPayload.cardPdfLink = cardPdfLink;
        } else if(selectedCardInsertDesignFormat === 'template') {
          const cardFrontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`) ?.attr('data-id');
          const cardFrontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`).val();
          const cardBackTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-back-template`) ?.attr('data-id');
          const cardBackTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-back-template`).val();
          previewPayload.cardFrontTemplateId = cardFrontTemplateId;
          previewPayload.cardFrontTemplateName = cardFrontTemplateName;
          previewPayload.cardBackTemplateId = cardBackTemplateId;
          previewPayload.cardBackTemplateName = cardBackTemplateName;
        } else {
          const cardfrontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).val().trim();
          const cardbackHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back-card-insert`).val().trim();
          previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
          previewPayload.cardbackHtmlContent = cardbackHtmlContent;
        }
      }
    } else if ($(`.${selectedMessageType} .screen-3`).css('display') === 'block') {
      const description = $(`.${selectedMessageType} .${selectedCreationType} .description`).val();
      const isExpressDelivery = $(`.${selectedMessageType} .${selectedCreationType} .express-delivery-input`).is(':checked');
      const mailingClass = $(`.${selectedMessageType} .${selectedCreationType} .mailing-class`).val();

      previewPayload.screen = 'existing-template';
      previewPayload.description = description;
      previewPayload.mailingClass = mailingClass;
      previewPayload.isExpressDelivery = isExpressDelivery;

      if (isTrifoldEnabled && selectedCardInsertType === 'singleSide') {
        const singleSideTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .singleSideTemplate`) ?.attr('data-id');
        const singleSideTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .singleSideTemplate`).val();
        previewPayload.singleSideTemplateId = singleSideTemplateId;
        previewPayload.singleSideTemplateName = singleSideTemplateName;
      } else {
        const frontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .frontTemplate`) ?.attr('data-id');
        const frontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .frontTemplate`).val();
        previewPayload.frontTemplateId = frontTemplateId;
        previewPayload.frontTemplateName = frontTemplateName;

        if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert') {
          const backTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .backTemplate`)?.attr('data-id');
          const backTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .backTemplate`).val();
          previewPayload.backTemplateId = backTemplateId;
          previewPayload.backTemplateName = backTemplateName;
        }
      }

      if(selectedMessageType === 'LettersCardInsert' && isCartInsertEnabled && selectedCardInsertType === 'doubleSide'){
        const frontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .creation-template`).val().trim();
        const frontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .creation-template`) ?.attr('data-id');

        previewPayload.frontTemplateId = frontTemplateId;
        previewPayload.frontTemplateName = frontTemplateName;
        previewPayload.plasticCardSize = selectedPlasticCardSize;

        if(selectedCardInsertDesignFormat === 'pdf') {
          const cardPdfLink = $(`.${selectedMessageType} .${selectedCreationType} .cardPdfLink`).val().trim();
          previewPayload.cardPdfLink = cardPdfLink;
        } else if(selectedCardInsertDesignFormat === 'template') {
          const cardFrontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`) ?.attr('data-id');
          const cardFrontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`).val();
          const cardBackTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-back-template`) ?.attr('data-id');
          const cardBackTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-back-template`).val();
          previewPayload.cardFrontTemplateId = cardFrontTemplateId;
          previewPayload.cardFrontTemplateName = cardFrontTemplateName;
          previewPayload.cardBackTemplateId = cardBackTemplateId;
          previewPayload.cardBackTemplateName = cardBackTemplateName;
        } else{
          const cardfrontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).val().trim();
          const cardbackHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back-card-insert`).val().trim();
          previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
          previewPayload.cardbackHtmlContent = cardbackHtmlContent;
        }

      }else if(selectedMessageType === 'LettersCardInsert' && isCartInsertEnabled && selectedCardInsertType === 'singleSide'){
        const frontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .creation-template`).val().trim();
        const frontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .creation-template`) ?.attr('data-id');

        previewPayload.frontTemplateId = frontTemplateId;
        previewPayload.frontTemplateName = frontTemplateName;
        previewPayload.plasticCardSize = selectedPlasticCardSize;

        if(selectedCardInsertDesignFormat === 'pdf') {
          const cardPdfLink = $(`.${selectedMessageType} .${selectedCreationType} .cardPdfLink`).val().trim();
          previewPayload.cardPdfLink = cardPdfLink;
        } else if(selectedCardInsertDesignFormat === 'template') {
          const cardFrontTemplateId = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`) ?.attr('data-id');
          const cardFrontTemplateName = $(`.${selectedMessageType} .${selectedCreationType} .card-front-template`).val();
          previewPayload.cardFrontTemplateId = cardFrontTemplateId;
          previewPayload.cardFrontTemplateName = cardFrontTemplateName;
        } else{
          const cardfrontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front-card-insert`).val().trim();
          previewPayload.cardfrontHtmlContent = cardfrontHtmlContent;
        }
      }

      if(isTrifoldEnabled) {
        const frontHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-front`).val();
        const backHtmlContent = $(`.${selectedMessageType} .${selectedCreationType} .html-editor-back`).val();
        const templateCardSize = $(`.${selectedMessageType} .${selectedCreationType} .Template-card-size .radio-input:checked`).val();
        previewPayload.frontHtmlContent = frontHtmlContent;
        previewPayload.backHtmlContent = backHtmlContent;
        previewPayload.cardSize = templateCardSize;
      }

      if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert' ) {
        const size = $(`.${selectedMessageType} .existingTemplate-size .radio-input:checked`).val();
        previewPayload.size = size;
      }
    }
  }

  async function createMessage() {
    const baseUrl = POSTGRID_API_BASE_URL;
    let messageType = $('input[name=\'msgType\']:checked').val();
    let isCartInsertEnabled = $('#card-insert').prop('checked');
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
    let selectedCardInsertDesignFormat = $('input[name=\'cardInsertType\']:checked').val().replace(/\s+/g, '');

    if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    }

    let isTrifoldEnabled = selectedMessageType === 'trifold';
    const selectedCardInsertType = $('input[name="cardType"]:checked').val();
    const url = selectedMessageType === 'selfmailer' || selectedMessageType === 'trifold' ? baseUrl + 'self_mailers' : baseUrl + selectedMessageType.toLowerCase();
    let apiKey = previewPayload.liveApiKeyEnabled ? previewPayload.live_api_key : previewPayload.test_api_key;

    if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
      selectedMessageType = 'LettersCardInsert';
    }

    let data;
    let headers = {
      'x-api-key': apiKey
    };

    if(previewPayload.screen === 'pdf'){
      data = new FormData();
      data.append('to', toContact);
      data.append('from', fromContact.id || '');
      data.append('description', previewPayload.description);

      if(selectedMessageType !== 'Letters' && selectedMessageType !== 'LettersCardInsert') {
        data.append('size',previewPayload.size);
      }
      
      if(isTrifoldEnabled|| !previewPayload.isExpressDelivery) {
        data.append('mailingClass', previewPayload.mailingClass);
      }

      if(isTrifoldEnabled) {
        data.append('adhesiveInsert[size]',previewPayload.cardSize);
        let pdfLinkKey = selectedCardInsertType === 'doubleSide' ? 'adhesiveInsert[singleSided][pdf]' : 'adhesiveInsert[doubleSided][pdf]';
        data.append(pdfLinkKey,previewPayload.pdfLinkInput);
        data.append('insideHTML', previewPayload.frontHtmlContent);
        data.append('outsideHTML', previewPayload.backHtmlContent);
      } else if(selectedMessageType === 'LettersCardInsert' && selectedCardInsertType === 'singleSide') {
        data.append('plasticCard[size]', previewPayload.plasticCardSize);
        data.append('express', previewPayload.isExpressDelivery);
        data.append('pdf', previewPayload.pdf);

        if(selectedCardInsertDesignFormat === 'html') {
          data.append('plasticCard[singleSided][html]',previewPayload.cardfrontHtmlContent);
        } else if(selectedCardInsertDesignFormat === 'pdf') {
          data.append('plasticCard[singleSided][pdf]',previewPayload.cardPdfLink);
        } else if(selectedCardInsertDesignFormat === 'template') {
          data.append('plasticCard[singleSided][template]',previewPayload.cardFrontTemplateId);
        }
        setLetterPreviewPayload(data, previewPayload);

      } else if(selectedMessageType === 'LettersCardInsert' && selectedCardInsertType === 'doubleSide') {
        data.append('plasticCard[size]', previewPayload.plasticCardSize);
        data.append('express', previewPayload.isExpressDelivery);
        data.append('pdf', previewPayload.pdf);

        if(selectedCardInsertDesignFormat === 'html') {
          data.append('plasticCard[doubleSided][frontHTML]',previewPayload.cardfrontHtmlContent);
          data.append('plasticCard[doubleSided][backHTML]',previewPayload.cardbackHtmlContent);
        } else if(selectedCardInsertDesignFormat === 'pdf') {
          data.append('plasticCard[doubleSided][pdf]', previewPayload.cardPdfLink);
        } else if(selectedCardInsertDesignFormat === 'template') {
          data.append('plasticCard[doubleSided][frontTemplate]', previewPayload.cardFrontTemplateId);
          data.append('plasticCard[doubleSided][backTemplate]', previewPayload.cardBackTemplateId);
        }
        setLetterPreviewPayload(data, previewPayload);
      } else {
        data.append('express', previewPayload.isExpressDelivery);
        data.append('pdf', previewPayload.pdf);
        setLetterPreviewPayload(data, previewPayload);
      } 
    } else if (previewPayload.screen === 'html') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      data = new URLSearchParams({
        'to': toContact,
        'from': fromContact.id || '',
        'express': previewPayload.isExpressDelivery,
        'description': previewPayload.description,
        'mergeVariables[language]': 'english',
        'metadata[company]': 'PostGrid'
      });

      if(selectedMessageType === 'Postcards'){
        data.append('frontHTML', previewPayload.frontHtmlContent);
        data.append('backHTML', previewPayload.backHtmlContent);
        data.append('size', previewPayload.size);
      } else if(selectedMessageType === 'selfmailer'){
        data.append('insideHTML', previewPayload.frontHtmlContent);
        data.append('outsideHTML', previewPayload.backHtmlContent);
        data.append('size', previewPayload.size);
      } else if(selectedMessageType === 'trifold'){
        data.append('insideHTML', previewPayload.frontHtmlContent);
        data.append('outsideHTML', previewPayload.backHtmlContent);
        data.append('size', previewPayload.size);
        data.delete('express');
        if(selectedCardInsertType === 'doubleSide'){
          data.append('adhesiveInsert[size]', previewPayload.cardSize);
          data.append('adhesiveInsert[doubleSided][outsideHTML]', previewPayload.cardbackHtmlContent);
          data.append('adhesiveInsert[doubleSided][insideHTML]',  previewPayload.cardfrontHtmlContent);
        }else{
          data.append('adhesiveInsert[size]', previewPayload.cardSize);
          data.append('adhesiveInsert[singleSided][html]', previewPayload.cardfrontHtmlContent);
        }
      } else if(selectedMessageType === 'Letters' || selectedMessageType === 'LettersCardInsert'){
        data.append('html', previewPayload.frontHtmlContent);
        setLetterPreviewPayload(data, previewPayload);
        if(selectedMessageType !== 'Letters' && selectedCardInsertType === 'singleSide') {
          data.append('plasticCard[size]', previewPayload.plasticCardSize);
          if(selectedCardInsertDesignFormat === 'html') {
            data.append('plasticCard[singleSided][html]',previewPayload.cardfrontHtmlContent);
          } else if(selectedCardInsertDesignFormat === 'pdf') {
            data.append('plasticCard[singleSided][pdf]',previewPayload.cardPdfLink);
          } else if(selectedCardInsertDesignFormat === 'template') {
            data.append('plasticCard[singleSided][template]',previewPayload.frontTemplateId);
          }
        } else if(selectedMessageType === 'LettersCardInsert' && selectedCardInsertType === 'doubleSide') {
          data.append('plasticCard[size]', previewPayload.plasticCardSize);
          if(selectedCardInsertDesignFormat === 'html') {
            data.append('plasticCard[doubleSided][frontHTML]',previewPayload.cardfrontHtmlContent);
            data.append('plasticCard[doubleSided][backHTML]',previewPayload.cardbackHtmlContent);
          } else if(selectedCardInsertDesignFormat === 'pdf') {
            data.append('plasticCard[doubleSided][pdf]',previewPayload.cardPdfLink);
          } else if(selectedCardInsertDesignFormat === 'template') {
            data.append('plasticCard[doubleSided][frontTemplate]',previewPayload.cardFrontTemplateId);
            data.append('plasticCard[doubleSided][backTemplate]',previewPayload.cardBackTemplateId);
          }
        }
      }
      if (!previewPayload.isExpressDelivery) {
        data.append('mailingClass', previewPayload.mailingClass);
      }
    } else if(previewPayload.screen === 'existing-template') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      data = new URLSearchParams({
        'to': toContact,
        'from': fromContact.id || '',
        'description': previewPayload.description,
        'express': previewPayload.isExpressDelivery,
      });
      if(messageType === 'Postcards'){
        data.append('frontTemplate', previewPayload.frontTemplateId);
        data.append('backTemplate', previewPayload.backTemplateId);
        data.append('size', previewPayload.size);
      } else if(messageType === 'selfmailer'){
        data.append('size', previewPayload.size);
        if(isTrifoldEnabled) {
          if(selectedCardInsertType === 'singleSide') {
            data.append('adhesiveInsert[singleSided][template]', previewPayload.singleSideTemplateId);
          } else if(selectedCardInsertType === 'doubleSide') {
            data.append('adhesiveInsert[doubleSided][insideTemplate]', previewPayload.frontTemplateId);
            data.append('adhesiveInsert[doubleSided][outsideTemplate]', previewPayload.backTemplateId);
          }
          data.append('adhesiveInsert[size]', previewPayload.cardSize);
          data.append('insideHTML', previewPayload.frontHtmlContent);
          data.append('outsideHTML', previewPayload.backHtmlContent);
          data.delete('express');
        }else {
          data.append('insideTemplate', previewPayload.frontTemplateId);
          data.append('outsideTemplate', previewPayload.backTemplateId);
        }
      } else if(selectedMessageType === 'Letters' || selectedMessageType === 'LettersCardInsert'){
        data.append('template', previewPayload.frontTemplateId);
        setLetterPreviewPayload(data, previewPayload);
        if(selectedMessageType === 'LettersCardInsert' && selectedCardInsertType !== 'doubleSide') {
          data.append('plasticCard[size]', previewPayload.plasticCardSize);
          if(selectedCardInsertDesignFormat === 'html') {
            data.append('plasticCard[singleSided][html]',previewPayload.cardfrontHtmlContent);
          } else if(selectedCardInsertDesignFormat === 'pdf') {
            data.append('plasticCard[singleSided][pdf]',previewPayload.cardPdfLink);
          } else if(selectedCardInsertDesignFormat === 'template') {
            data.append('plasticCard[singleSided][template]',previewPayload.cardFrontTemplateId);
          }
        } else if(selectedMessageType === 'LettersCardInsert' && selectedCardInsertType === 'doubleSide') {
          data.append('plasticCard[size]', previewPayload.plasticCardSize);
          if(selectedCardInsertDesignFormat === 'html') {
            data.append('plasticCard[doubleSided][frontHTML]',previewPayload.cardfrontHtmlContent);
            data.append('plasticCard[doubleSided][backHTML]',previewPayload.cardbackHtmlContent);
          } else if(selectedCardInsertDesignFormat === 'pdf') {
            data.append('plasticCard[doubleSided][pdf]',previewPayload.cardPdfLink);
          } else if(selectedCardInsertDesignFormat === 'template') {
            data.append('plasticCard[doubleSided][frontTemplate]',previewPayload.cardFrontTemplateId);
            data.append('plasticCard[doubleSided][backTemplate]',previewPayload.cardBackTemplateId);
          }
        }
      }
      if (!previewPayload.isExpressDelivery) {
        data.append('mailingClass', previewPayload.mailingClass);
      }
    }

    mergeVariablesFields.forEach(field => {
      const key = `mergeVariables[${field}]`;
      const value = toTestCamelCase(field);
      data.append(key, value);
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: data
      });

      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Type: ${errorResponse.error.type} Message: ${errorResponse.error.message}`);
      } else {
        $('.error-toast-wrap').removeClass('show');
        $('.error-toast-message').text('');
      }

      const result = await response.json();

      previewPayload.pdfLink = previewPayload.pdf;

      if(previewPayload.liveApiKeyEnabled) {
        let msgType = selectedMessageType.toLowerCase();

        if(selectedMessageType === 'selfmailer') {
          msgType = 'self_mailers';
        } else if(selectedMessageType === 'LettersCardInsert') {
          msgType = 'letters';
        }

        deleteMailItem(msgType, result.id);
      }
      return result;
    } catch (error) {
      $('.error-toast-message').text(`Error: ${JSON.stringify(error.message)}`);
      $('.error-toast-wrap').addClass('show');
      handleValidationFailure();
    }
  }

  function setLetterPreviewPayload(data, previewPayload) {
    if(previewPayload.extraService !== '' && previewPayload.extraService !== undefined && !previewPayload.isExpressDelivery) {
      data.append('extraService', previewPayload.extraService);
    }
    if(previewPayload.envelopeType !== '' && previewPayload.envelopeType !== undefined) {
      data.append('envelopeType', previewPayload.envelopeType);
    }
    if(previewPayload.returnEnvelope !== '' && previewPayload.returnEnvelope !== undefined) {
      data.append('returnEnvelope', previewPayload.returnEnvelope);
    }
    if (previewPayload.addressPlacement !== true && previewPayload.perforatedPage) {
      data.append('perforatedPage', 1);
    }
    if(previewPayload.perforatedPage !== true && previewPayload.addressPlacement === true) {
      data.append('addressPlacement', 'insert_blank_page');
    } else {
      data.append('addressPlacement', 'top_first_page');
    }
    data.append('color', previewPayload.color);
    data.append('doubleSided', previewPayload.doubleSided);
  }

  async function fetchMessageDetails(messageId) {
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
    const urlMessageType = selectedMessageType === 'selfmailer' ? 'self_mailers' : selectedMessageType.toLowerCase();
    const apiUrl = `${POSTGRID_API_BASE_URL}${urlMessageType}/${messageId}`;
    const apiKey = previewPayload.liveApiKeyEnabled ? previewPayload.live_api_key : previewPayload.test_api_key;

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  async function showPdfPreview(messageId, retryOnce = false, isRetry = false, startTime = Date.now()) {
    try {
      if (!isRetry) {
        $('#pdf-preview').attr('src', '');
        $('#pdf-preview-container').hide();
        $('.preview-message').html('<div>Review your mail piece before sending!</div><div>Click the button below to check the preview.</div>').show();
      }
  
      $('.retry-btn-wrap .loader').addClass('show');
      $('.retry-preview-btn').hide();
      const messageDetails = await fetchMessageDetails(messageId);
      const pdfUrl = messageDetails.url;
  
      if (pdfUrl) {
        previewPayload.previewURL = pdfUrl;
        $('.preview-message').html('<div>Review your mail piece before sending!</div><div>Click the button below to check the preview.</div>');
        $('.retry-preview-btn, .preview-message').css('display', 'inline-block');
        $('.retry-preview-btn').text('Show Preview');
        $('.retry-btn-wrap .loader').removeClass('show');
  
        $('.retry-preview-btn').off('click').on('click', function () {
          $('#pdf-preview').attr('src', pdfUrl + '#toolbar=0&navpanes=0');
          $('#pdf-preview-container').show();
          $('.retry-preview-btn, .preview-message').hide();
        });
      } else  {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= 60000 || retryOnce) {
          $('.retry-btn-wrap .loader').removeClass('show');
          $('.preview-message').html('<div>Failed to load the preview after several attempts.</div> <div>To try again, click the retry button.</div>').show();
          $('.retry-preview-btn').text('Retry').show();
          return;
        }

        $('#pdf-preview-container, .retry-preview-btn').hide();
        $('.preview-message').show();
        $('.retry-btn-wrap .loader').addClass('show');
  
        setTimeout(() => {
          showPdfPreview(messageId, false, true, startTime);
        }, 2000);
      }
    } catch {
      $('#pdf-preview-container, .retry-preview-btn').hide();
      $('.preview-message').html('<div>An error occurred while loading the preview.</div>').show();
    }
  }  

  async function getPreviewURL() {
    try {
      const messageResponse =  await createMessage();
      const messageId = messageResponse.id;
      previewPayload.messageId = messageId;

      setTimeout(async function() {
        connection.trigger('nextStep');
        await showPdfPreview(messageId);
      }, 2000);

    } catch {
      handleValidationFailure();
      $('.preview-container .retry-preview-btn').addClass('show');
      $('#pdf-preview-container').css('display','none');
      $('.pdf-preview-error-msg').text('Failed to fetch preview.');
    }
  }

  async function createContact(isFromContact = false) {
    const url = `${POSTGRID_API_BASE_URL}contacts`;

    const defaults = {
      firstName: 'Kevin',
      lastName: 'Smith',
      companyName: 'PostGrid',
      email: 'kevinsmith@postgrid.com',
      addressLine1: '20-20 Bay St',
      addressLine2: 'Floor 11',
      city: 'Toronto',
      provinceOrState: 'ON',
      countryCode: 'US',
      postalOrZip: 'M5J 2N8'
    };
  
    const contact = isFromContact ? {
      firstName: $('#newContactFirstName').val().trim(),
      lastName: $('#newContactLastName').val().trim(),
      companyName: $('#newContactCompanyName').val().trim(),
      email: $('#newContactEmail').val().trim(),
      addressLine1: $('#newContactAddressLine1').val().trim(),
      addressLine2: $('#newContactAddressLine2').val().trim(),
      city: $('#newContactCity').val().trim(),
      provinceOrState: $('#newContactState').val().trim(),
      countryCode: $('#newContactCountryCode').val().trim(),
      postalOrZip: $('#newContactPostal').val().trim()
    } : defaults;

    const formData = new URLSearchParams();
    Object.entries(contact).forEach(([key, value]) => {
      formData.append(key, value || '');
    });
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-key': previewPayload.liveApiKeyEnabled
            ? previewPayload.live_api_key
            : previewPayload.test_api_key
        },
        body: formData
      });
  
      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Type: ${errorResponse.error.type} Message: ${errorResponse.error.message}`);
      }
  
      $('.error-toast-wrap').removeClass('show');
      $('.error-toast-message').text('');
  
      const data = await response.json();
  
      if (isFromContact) {
        fromContact.id = data.id;
        fromContact.name = data.firstName;
        previewPayload.newContactFields = contact;
      } else {
        toContact = data.id;
      }
  
      return data;
    } catch (error) {
      if (isFromContact) {
        $('.error-toast-message').text(`Error: ${error.message}`);
        $('.error-toast-wrap').addClass('show');
        handleValidationFailure();
      }
      throw error;
    }
  }

  function fetchContacts(searchQuery) {
    previewPayload.contactEnvironment = previewPayload.liveApiKeyEnabled ? 'Live' : 'Test';
    $.ajax({
      url: `${POSTGRID_API_BASE_URL}contacts`,
      method: 'GET',
      data: searchQuery ? { search: searchQuery, limit: 10 } : { limit: 10 },
      headers: {
        'x-api-key': previewPayload.liveApiKeyEnabled ? previewPayload.live_api_key : previewPayload.test_api_key
      },
      success: function (response) {
        $('#dropdown-options').empty();
        if (response.data.length === 0) {
          const $emptyItem = $('<div>')
            .text('No options available')
            .addClass('disabled');
          $('#dropdown-options').append($emptyItem);
        } else {
          response.data.forEach(function (contact) {
            const $item = $('<div>')
              .text(contact.firstName ? contact.firstName : contact.companyName)
              .data('contact', contact);
            $('#dropdown-options').append($item);
          });
        }

        $('#dropdown-options').show();
      },
      error: function (error) {
        throw error;
      }
    });
  }

  function deleteMailItem(messageType, mailItemId) {
    const url = `${POSTGRID_API_BASE_URL}${messageType}/${mailItemId}`;
  
    fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': previewPayload.live_api_key
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to delete ${messageType}`);
        }
        return response.json();
      });
  }

  function toTestCamelCase(text) {
    if (!text) {
      return '';
    }
    const camelCase = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
    return 'test' + camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function validateToContact() {
    let isValid = true;
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
    let selectedSenderContactType = $('input[name="senderContactType"]:checked').val().replace(/\s+/g, '');
    let isCartInsertEnabled = $('#card-insert').prop('checked');
    let fromContactElement = $('.contact-dropdown-container #search-contact');
    let newContactFieldWrap = $('.sender-contact-container .create-contact .mapping-fields');
    const requiredFields = ['#addressLine1', '#firstName', '#companyName', '#city', '#provinceOrState', '#countryCode'];
    let isAnyFieldEmpty = false;

    if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    } else if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
      selectedMessageType = 'LettersCardInsert';
    }

    resetToContactMappingErrors();
    if(selectedSenderContactType === 'existing-contact' && selectedMessageType !== 'Postcards'){
      isValid = validateInputField(fromContactElement) ? isValid : false ;
    } else if(selectedSenderContactType === 'create-contact'){
      const firstName = $('#newContactFirstName').val().trim();
      const companyName = $('#newContactCompanyName').val().trim();

      if (firstName === '' && companyName === '') {
        $('#newContactFirstName, #newContactCompanyName').addClass('error');
        newContactFieldWrap.siblings('.error-msg').addClass('show');
        isValid = false;
      } else {
        $('#newContactFirstName, #newContactCompanyName').removeClass('error');
      }

      let requiredFields = ['#newContactAddressLine1', '#newContactCity', '#newContactState', '#newContactCountryCode'];
      requiredFields.forEach(selector => {
        const $field = $(selector);
        const value = $field.val().trim();
      
        if (value === '') {
          $field.addClass('error');
          newContactFieldWrap.siblings('.error-msg').addClass('show');
          isValid = false;
        }
      });
    }

    previewPayload.fromContact = fromContact;
    requiredFields.forEach(selector => {
      let value = $(selector).val();
      if (selector === '#firstName' || selector === '#companyName') {
        if ($('#firstName').val() === 'Select' && $('#companyName').val() === 'Select') {
          $('#firstName, #companyName').css('border', '1px solid red');
          isAnyFieldEmpty = true;
        }
      } else {
        if (value === 'Select') {
          $(selector).css('border', '1px solid red');
          isAnyFieldEmpty = true;
        }
      }
    });

    if (isAnyFieldEmpty) {
      $('.error-message-contact-mapping').text('Please fill all required fields.').css('color', 'red').show();
      isValid = false;
    }
    return isValid;
  }

  function resetToContactMappingErrors() {
    $('.contact-dropdown-container input').removeClass('error');
    $('.contact-dropdown-container .error-msg').removeClass('show');
    $('.error-toast-wrap').removeClass('show');
    $('.error-toast-message').text('');
    $('.mapping-fields-group select').css('border', '');
    $('.error-message-contact-mapping').text('').hide();
    const newContactFieldWrap = $('.sender-contact-container .create-contact .mapping-fields');
    newContactFieldWrap.find('input').removeClass('error');
    newContactFieldWrap.siblings('.error-msg').removeClass('show');
  }

  async function fetchTemplates(searchQuery = '', dropdownName = '', $inputElement = '') {
    const requestOptions = {
      method: 'GET',
      headers: { 'x-api-key': previewPayload.liveApiKeyEnabled ? previewPayload.live_api_key : previewPayload.test_api_key },
      redirect: 'follow'
    };

    previewPayload.templateEnvironment = previewPayload.liveApiKeyEnabled ? 'Live' : 'Test';

    try {
      const response = await fetch(
        `${POSTGRID_API_BASE_URL}templates?limit=10&search=${encodeURIComponent(searchQuery)}`,
        requestOptions
      );
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const dataJson = await response.json();
      const data = dataJson.data;
  
      const sortedData = data.sort((a, b) => {
        const descriptionA = a.description ? a.description.toString().toLowerCase() : '';
        const descriptionB = b.description ? b.description.toString().toLowerCase() : '';
        return descriptionA.localeCompare(descriptionB);
      });
  
      let isCartInsertEnabled = $('#card-insert').prop('checked');
      let selectedCardInsertType;
      if (isCartInsertEnabled) {
        selectedCardInsertType = $('input[name="cardType"]:checked').val();
      }
  
      let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
  
      if (isCartInsertEnabled && selectedMessageType === 'selfmailer') {
        selectedMessageType = 'trifold';
      } else if (isCartInsertEnabled && selectedMessageType === 'Letters') {
        selectedMessageType = 'LettersCardInsert';
      }

      if (selectedCardInsertType === 'singleSide' && !selectedMessageType.toLowerCase().includes('letter')) {
        populateDropdown('singleSideTemplateList', sortedData);
      } else {
        if (dropdownName !== '') {
          const $list = $inputElement.parent('.template-dropdown-wrap').siblings('.dropdown-options');
          populateDropdown(dropdownName, sortedData, $list);
        } else {
          populateDropdown('frontTemplateList', sortedData);
          populateDropdown('backTemplateList', sortedData);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async function fetchReturnEnvelope(searchQuery = '') {
    const requestOptions = {
      method: 'GET',
      headers: { 'x-api-key': previewPayload.liveApiKeyEnabled ? previewPayload.live_api_key : previewPayload.test_api_key },
      redirect: 'follow'
    };

    previewPayload.envelopeEnvironment = previewPayload.liveApiKeyEnabled ? 'Live' : 'Test';

    try {
      const response = await fetch(`${POSTGRID_API_BASE_URL}return_envelopes?limit=10&search=${encodeURIComponent(searchQuery)}`, requestOptions);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const dataJson = await response.json();
      const data = dataJson.data;

      const sortedData = data.sort((a, b) => {
        const descriptionA = a.description ? a.description.toString().toLowerCase() : '';
        const descriptionB = b.description ? b.description.toString().toLowerCase() : '';
        return descriptionA.localeCompare(descriptionB);
      });
      populateDropdown('returnEnvelopeList', sortedData);
    } catch (error) {
      throw error;
    }
  }

  function populateDropdown(templateName, templates, templateList = '') {
    let isCartInsertEnabled = $('#card-insert').prop('checked');
    let selectedMessageType = $('input[name="msgType"]:checked').val().replace(/\s+/g, '');
    if (isCartInsertEnabled && selectedMessageType === 'selfmailer') {
      selectedMessageType = 'trifold';
    } else if (isCartInsertEnabled && selectedMessageType === 'Letters') {
      selectedMessageType = 'LettersCardInsert';
    }
    let selectedCreationType = $('input[name=\'createType\']:checked').val().replace(/\s+/g, '');
  
    const $list = templateList === '' ? $(`.${selectedMessageType} .${selectedCreationType} .${templateName}`) : templateList;
    $list.empty();
  
    if (templates.length === 0) {
      const $emptyItem = $('<li>')
        .text('No options available')
        .attr('data-id', '')
        .addClass('dropdown-item disabled');
      $list.append($emptyItem);
    }
  
    templates.forEach(template => {
      const $listItem = $('<li>')
        .text(template.description || 'No description')
        .attr('data-id', template.id)
        .addClass('dropdown-item');
      $list.append($listItem);
    });
  
    $list.off('mousedown', '.dropdown-item').on('mousedown', '.dropdown-item', function () {
      const $clickedItem = $(this);
      const templateId = $clickedItem.attr('data-id');
      const templateDesc = $clickedItem.text();
  
      const dropdownTypeLabel = templateName.includes('returnEnvelope') ? 'return-envelope' : 'template';
      const $dropdownTemplateInput = $clickedItem
        .parent(`.${templateName}`)
        .siblings(`.${dropdownTypeLabel}-dropdown-wrap`)
        .find(`.${templateName.replace('List', '')}`);
  
      $dropdownTemplateInput.val(templateDesc || 'No description').attr('data-id', templateId);
      $list.hide();
    });
  }

  function prepopulateToDeMapping(){
    $.each(previewDEMapOptions, function(key, value) {
      switch (key) {
      case 'firstName':
        $('#firstName').val(value).change();  
        break;
      case 'lastName':
        $('#lastName').val(value).change();
        break;
      case 'companyName':
        $('#companyName').val(value).change();
        break;
      case 'email':
        $('#email').val(value).change();
        break;
      case 'addressLine1':
        $('#addressLine1').val(value).change();
        break;
      case 'addressLine2':
        $('#addressLine2').val(value).change();
        break;
      case 'city':
        $('#city').val(value).change();
        break;
      case 'provinceOrState':
        $('#provinceOrState').val(value).change();
        break;
      case 'countryCode':
        $('#countryCode').val(value).change();
        break;
      case 'postalOrZip':
        $('#postalOrZip').val(value).change();
        break;
      default:
        break;
      }
    });
  }

  async function validateApiKey(apiKey, inputSelector, errorSelector) {
    if (!apiKey) {
      return true;
    }
  
    const url = `${POSTGRID_API_BASE_URL}contacts?limit=1`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'x-api-key': apiKey }
      });
  
      if (!response.ok) {
        $(inputSelector).css('border', '1px solid red');
        $(errorSelector).text(`Invalid API key: ${apiKey}`).show();
        return false;
      }
    } catch (error) {
      throw error;
    }
    return true;
  }
  
  async function authenticateApiKeys() {
    const testApiKey = $('#test-api-key').val().trim();
    const liveApiKey = $('#live-api-key').val().trim();
  
    const isTestKeyValid = await validateApiKey(testApiKey, '#test-api-key', '#test-api-key-error');
    const isLiveKeyValid = await validateApiKey(liveApiKey, '#live-api-key', '#live-api-key-error');
  
    return isTestKeyValid && isLiveKeyValid;
  }

  function fetchClientCredentials(){
    fetch('/client-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authTSSD: authTSSD,
        token: authToken,
        externalKey : previewPayload.credentialExternalKey
      })
    })
      .then(response => response.text())
      .then(xmlString => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
        const properties = xmlDoc.getElementsByTagName('Property');
    
        for (let i = 0; i < properties.length; i++) {
          const name = properties[i].getElementsByTagName('Name')[0].textContent;
          const value = properties[i].getElementsByTagName('Value')[0].textContent;
  
          if (name === 'Client_Id') {
            previewPayload.clientId = value;
          }
          else if (name === 'Client_Secret') {
            previewPayload.clientSecret = value;
          }
          else if (name === 'TestAPIKey') {
            if(!doesPayloadHasAPIKeys) {
              $('#test-api-key').val(value);
            }
          }
          else if (name === 'LiveAPIKey') {
            if(!doesPayloadHasAPIKeys) {
              $('#live-api-key').val(value);
            }
          }
          connection.trigger('updateButton', {
            button: 'next',
            enabled: true,
          });
          $('.loader-overlay').removeClass('show');
          $('.activity-loader').removeClass('show');
          $('body').css('overflow', '');
        }
      })
      .catch((error) => {
        throw error;
      });
  }

  async function fetchExternalKey(deName){
    fetch('/fetch-external-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authTSSD: authTSSD,
        token: authToken, 
        deName : deName
      })
    })
      .then(response => response.text())
      .then(xmlString => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
        const properties = xmlDoc.getElementsByTagName('CustomerKey');
        const externalKey = properties[0].textContent;
        if(deName === 'Postgrid_Logging_Data') {
          previewPayload.loggingExternalKey = externalKey;
        } else {
          previewPayload.credentialExternalKey = externalKey;
          fetchClientCredentials();
        }
      })
      .catch((error) => {
        throw error;
      });
  }

  $('.preforate-first-page-input, .insert-blank-page-input').on('change', function () {
    const $checkboxContainer = $(this).closest('.checkboxes-container');
    const $perforate = $checkboxContainer.find('.preforate-first-page-input');
    const $insertBlank = $checkboxContainer.find('.insert-blank-page-input');
  
    const isPerforateChecked = $perforate.is(':checked');
    const isInsertBlankChecked = $insertBlank.is(':checked');
  
    $insertBlank.prop('disabled', isPerforateChecked);
    $perforate.prop('disabled', isInsertBlankChecked);
  });

  $('.toggle-password').on('click', toggleApiKeyVisibility);
  $('input.api-key').on('input', hideError);

  $('.step2radioBTN').change(function () {
    var isSelfMailer = $('#self-mailer').is(':checked');
    if(isSelfMailer) {
      if($('#card-insert').is(':checked')) {
        $('#extTempId').css('display','none');
        $('label[for="extTempId"]').css('display','none');
        $('#extTempId').prop('checked', false);
      } else {
        $('#extTempId').css('display','block');
        $('label[for="extTempId"]').css('display','block');
      }
    } else {
      $('#extTempId').css('display','block');
      $('label[for="extTempId"]').css('display','block');
    }

    connection.trigger('updateButton', {
      button: 'next',
      enabled: true
    });
  });

  $('.preview-container .retry-preview-btn').click(async function() {
    await showPdfPreview(previewPayload.messageId, true, true);
  });

  $('.express-delivery-input').on('change', function() {
    var isChecked = $(this).prop('checked');
    var mailingClass = $(this).closest('.spacer').find('.mailing-class');
    var extraService = $(this).closest('.spacer').find('.extra-service');

    if (isChecked) {
      mailingClass.prop('disabled', true);
      extraService.prop('disabled', true).css('color','gray');
    } else {
      mailingClass.prop('disabled', false);
      let color = extraService.val() === 'Select Extra Service' ? 'gray' : 'black' ;
      extraService.prop('disabled', false).css('color',color);
    }
  });

  $('.return-envelope-input').on('blur', function() {
    const $wrapper = $(this).closest('.mapping-dropdown');
    const $noOptionsItem = $wrapper.find('.returnEnvelopeList .dropdown-item.disabled');
    
    if ($noOptionsItem.length && $noOptionsItem.text().trim() === 'No options available') {
      $(this).val('').trigger('input');
    }
  });

  $('.mapping-dropdown input').on('blur', function() {
    const $wrapper = $(this).closest('.mapping-dropdown');
    const $noOptionsItem = $wrapper.find('.dropdown-options .dropdown-item.disabled');
    
    if ($noOptionsItem.length && $noOptionsItem.text().trim() === 'No options available') {
      $(this).val('').trigger('input');
    }
  });

  $('#search-contact').on('blur', function() {
    const $wrapper = $(this).closest('.mapping-dropdown');
    const $noOptionsItem = $wrapper.find('#dropdown-options div.disabled');
    
    if ($noOptionsItem.length && $noOptionsItem.text().trim() === 'No options available') {
      $(this).val('').trigger('input');
    }
  });

  $('.extra-service-dropdown-wrap').click(function(){
    $(this).siblings('.extra-service-list').toggle();
  });

  $('.envelope-type-dropdown-wrap').click(function(){
    $(this).siblings('.envelope-type-list').toggle();
  });

  $('.dropdown-options .dropdown-item').click(function () {
    const selectedText = $(this).text();
    const selectedValue = $(this).attr('data-id');

    const $dropdown = $(this).closest('.mapping-dropdown');
    const $spacer = $(this).closest('.spacer');
  
    const $input = $dropdown.find('.input-field');
    const inputType = $input.hasClass('extra-service') ? 'extra-service' : 'envelope-type';
  
    $input.val(selectedText).attr('data-id', selectedValue);
  
    if (selectedValue === '') {
      $input.css('color', 'grey');
    } else {
      $input.css('color', 'black');
    }
  
    if (inputType === 'extra-service') {
      const $expressDelivery = $spacer.find('.express-delivery-input');
      if (selectedValue === '') {
        $expressDelivery.prop('disabled', false);
        $expressDelivery.siblings('span').css('color', 'black');
      } else {
        $expressDelivery.prop('disabled', true);
        $expressDelivery.siblings('span').css('color', 'gray');
      }
    }
  
    $dropdown.find('.dropdown-options').hide();
  });  

  $('#search-contact').on('input', debounce(function () {
    const searchQuery = $(this).val();
    if (searchQuery.length > 1) {
      fetchContacts(searchQuery);
    } else {
      $('#dropdown-options').empty().hide();
    }
    if ($(this).val().trim() === '') {
      $(this).blur();
    }
  }, 300));  

  $('#dropdown-options').on('click', 'div', function () {
    const contact = $(this).data('contact');
    var contactValue = contact.firstName ? contact.firstName : contact.companyName;
    $('#search-contact').val(contactValue);
    $('#dropdown-options').hide();
    fromContact.id = contact.id;
    fromContact.name = contactValue;
  });

  $('#search-contact').on('focus', function () {
    const searchQuery = $(this).val().trim();
    if ($('#dropdown-options').is(':hidden')) {
      if (searchQuery === '' && $('#dropdown-options div').length === 0) {
        fetchContacts();
      } else {
        $('#dropdown-options').show();
      }
    }
  });

  $('.mapping-fields-group #firstName, .mapping-fields-group #companyName').change(function () {
    const firstName = $('.mapping-fields-group #firstName').val();
    const companyName = $('.mapping-fields-group #companyName').val();
  
    const $firstAsterisk = $('.mapping-fields-group label[for="firstName"] .asterisk');
    const $companyAsterisk = $('.mapping-fields-group label[for="companyName"] .asterisk');
  
    if (firstName === 'Select' && companyName === 'Select') {
      $firstAsterisk.show();
      $companyAsterisk.show();
    } else if (firstName !== 'Select' && companyName === 'Select') {
      $firstAsterisk.show();
      $companyAsterisk.hide();
    } else if (companyName !== 'Select' && firstName === 'Select') {
      $firstAsterisk.hide();
      $companyAsterisk.show();
    }
  });

  $('#front-template-input, #back-template-input, #selfMailer-insideTemplateInput, #selfMailer-outsideTemplateInput, #letter-template-input').on('focus', function () {
    $(this).closest('.template-dropdown-wrap').next('.dropdown-options').show();
  });

  $('#front-template-input, #back-template-input, #selfMailer-insideTemplateInput, #selfMailer-outsideTemplateInput, #letter-template-input').on('input', debounce(function () {
    const dropdownName = $(this).parent('.template-dropdown-wrap').siblings('.dropdown-options').attr('id');
    fetchTemplates($(this).val().trim(), dropdownName, $(this));
  }, 300));

  $(document).on('focus', '.template-input', function () {
    $(this).closest('.template-dropdown-wrap').next('.dropdown-options').show();
  });

  $(document).on('blur', '.template-input', function () {
    const $input = $(this);
    const $dropdown = $input.closest('.template-dropdown-wrap').siblings('.dropdown-options');

    $dropdown.hide();
  });
  
  $(document).on('input', '.template-input', debounce(function () {
    const dropdownName = $(this).parent('.template-dropdown-wrap').siblings('.dropdown-options').attr('id');
    fetchTemplates($(this).val().trim(), dropdownName, $(this));
  }, 300));

  $(document).on('focus', '.return-envelope-input', function () {
    $(this).closest('.return-envelope-dropdown-wrap').next('.dropdown-options').show();
  });

  $(document).on('input', '.return-envelope-input', debounce(function () {
    if ($(this).val().trim() === '') {
      $(this).attr('data-id', '');
    }
    fetchReturnEnvelope($(this).val().trim());
  }, 300));

  $('.remove-error-toast').on('click',()=>{
    $('.error-toast-wrap').removeClass('show');
  });

  $(document).ready(function () {
    const $liveModeToggle = $('.test-to-live-switch input');
    const $errorMessage = $('#liveModeError');
  
    if ($liveModeToggle.length > 0) {
      $('.test-to-live-switch')
        .on('mouseenter', function () {
          if ($liveModeToggle.prop('disabled')) {
            $errorMessage.show();
          }
        })
        .on('mouseleave', function () {
          $errorMessage.hide();
        });
  
      $liveModeToggle.on('change', function () {
        previewPayload.liveApiKeyEnabled = $(this).is(':checked');
      });
    }
  
    $('input, textarea, select').on('input change', function () {
      $(this).removeClass('error-field').next('.error-message').remove();
    });
  
    const today = new Date().toISOString().split('T')[0];
    $('#sendDate3').val(today).attr('min', today);
    
    $('input[name="senderContactType"]').on('change', function () {
      const selectedValue = $(this).val();
      if(previewPayload.prevContactType !== selectedValue) {
        resetContactFields();
        previewPayload.prevContactType = selectedValue;
      }
      $('.contact-option').addClass('hidden');
      $('.contact-option.' + selectedValue).removeClass('hidden');
    });

    function toggleAsterisk() {
      const firstName = $('#newContactFirstName').val().trim();
      const companyName = $('#newContactCompanyName').val().trim();

      if(firstName === '' && companyName === '') {
        $('label[for="newContactCompanyName"] .asterisk').show();
        $('label[for="newContactFirstName"] .asterisk').show();
      } else if (firstName !== '' && companyName === '') {
        $('label[for="newContactCompanyName"] .asterisk').hide();
        $('label[for="newContactFirstName"] .asterisk').show();
      } else if (companyName !== '' && firstName === '') {
        $('label[for="newContactFirstName"] .asterisk').hide();
        $('label[for="newContactCompanyName"] .asterisk').show();
      }
    }

    $('#newContactFirstName, #newContactCompanyName').on('input', toggleAsterisk);

    $(document).on('click', function (event) {
      let isCartInsertEnabled = $('#card-insert').prop('checked');
      let selectedMessageType = $('input[name="msgType"]:checked').val() !== undefined ? $('input[name="msgType"]:checked').val().replace(/\s+/g, '') : undefined;
      if(isCartInsertEnabled && selectedMessageType === 'selfmailer') {
        selectedMessageType = 'trifold';
      } else if(isCartInsertEnabled && selectedMessageType === 'Letters' ) {
        selectedMessageType = 'LettersCardInsert';
      }
      let selectedCreationType = $('input[name=\'createType\']:checked').val() !== undefined ? $('input[name=\'createType\']:checked').val().replace(/\s+/g, '') : undefined;
      
      const frontSelectors = [
        '#frontTemplateList',
        '#front-template-input',
        '#letter-template-input'
      ];
      
      const backSelectors = [
        '#backTemplateList',
        '#back-template-input'
      ];

      const isClickInsideDropdown = $(event.target).is('#dropdown-options, #search-contact');
      const isClickInsideFront = $(event.target).closest(frontSelectors.join(',')).length > 0;
      const isClickInsideBack = $(event.target).closest(backSelectors.join(',')).length > 0;
      const isClickInsideReturnEnvelope = $(event.target).closest('.returnEnvelopeList, .return-envelope-input.returnEnvelope').length > 0;
      const isClickInsideFrontSelfMailer = $(event.target).closest('#selfMailer-insideTemplateList, #selfMailer-insideTemplateInput').length > 0;
      const isClickInsideBackSelfMailer = $(event.target).closest('#selfMailer-outsideTemplateList, #selfMailer-outsideTemplateInput').length > 0;
      if (!isClickInsideDropdown) {
        $('#dropdown-options').hide();
      }
      if (!isClickInsideFront) {
        if(selectedMessageType !== 'LettersCardInsert'){
          $(`.${selectedMessageType} .${selectedCreationType} #frontTemplateList`).hide();
        }
      }
      if (!isClickInsideBack) {
        if(selectedMessageType !== 'LettersCardInsert'){
          $(`.${selectedMessageType} .${selectedCreationType} #backTemplateList`).hide();
        }
      }
      if (!isClickInsideReturnEnvelope) {
        $(`.${selectedMessageType} .${selectedCreationType} #returnEnvelopeList`).hide();
      }
      if(!isClickInsideFrontSelfMailer){
        $('#selfMailer-insideTemplateList').hide();
      }
      if(!isClickInsideBackSelfMailer){
        $('#selfMailer-outsideTemplateList').hide();
      }

      if (!$(event.target).closest('.extra-service-dropdown-wrap').length) {
        if($(`.${selectedMessageType} .${selectedCreationType} .extra-service-list`).css('display') === 'block') {
          $(`.${selectedMessageType} .${selectedCreationType} .extra-service-list`).css('display','none');
        }
      }
      if (!$(event.target).closest('.envelope-type-dropdown-wrap').length) {
        if($(`.${selectedMessageType} .${selectedCreationType} .envelope-type-list`).css('display') === 'block') {
          $(`.${selectedMessageType} .${selectedCreationType} .envelope-type-list`).css('display','none');
        }
      }
    });
  });
});
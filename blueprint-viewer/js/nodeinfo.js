/* Turns a raw node export into the title, kind and colours the editor would show. */
(function (global) {
  'use strict';
  var UA = global.UA;

  /* Approximate sRGB equivalents of the engine's default pin colours. */
  var PIN_COLORS = {
    exec: '#ffffff',
    bool: '#a30d0d',
    byte: '#00786d',
    enum: '#00786d',
    int: '#1fd8a3',
    int64: '#5fd8a3',
    real: '#98e33a',
    float: '#98e33a',
    double: '#6fc22b',
    name: '#c78bff',
    string: '#ff2fb4',
    text: '#e0709e',
    object: '#2f9df5',
    interface: '#dcff66',
    class: '#7b52d1',
    struct: '#3a6ee0',
    softobject: '#7cffff',
    softclass: '#ff7cff',
    delegate: '#ff3b3b',
    mcdelegate: '#ff3b3b',
    fieldpath: '#c78bff',
    wildcard: '#8a807f'
  };
  var STRUCT_COLORS = {
    Vector: '#ffb300', Vector3f: '#ffb300', Vector3d: '#ffb300', Vector2D: '#ffb300',
    Rotator: '#7f8cff', Transform: '#ff6a3d', Quat: '#7f8cff',
    LinearColor: '#3a6ee0', Color: '#3a6ee0'
  };

  UA.pinColor = function (pin) {
    if (!pin || !pin.category) return '#8a807f';
    var c = pin.category.toLowerCase();
    if (c === 'struct' && pin.subCategoryObject && STRUCT_COLORS[pin.subCategoryObject]) {
      return STRUCT_COLORS[pin.subCategoryObject];
    }
    if (c === 'real' && pin.subCategory) {
      var s = pin.subCategory.toLowerCase();
      if (PIN_COLORS[s]) return PIN_COLORS[s];
    }
    return PIN_COLORS[c] || '#8a807f';
  };

  UA.pinTypeLabel = function (pin) {
    if (!pin) return '';
    var c = pin.category || '?';
    if (pin.subCategoryObject) return pin.subCategoryObject;
    if (pin.subCategory) return pin.subCategory;
    return c;
  };

  /* Node title bar colours by role. */
  var KIND_COLORS = {
    event: '#9c2b2b',
    function: '#1c5c8c',
    pure: '#2b7a4f',
    variableGet: '#2b7a4f',
    variableSet: '#1c5c8c',
    flow: '#4a4d55',
    macro: '#2f5f96',
    cast: '#1c5c8c',
    terminal: '#6b3a92',
    comment: '#4d5560',
    knot: '#8a807f',
    other: '#3d4450'
  };
  UA.kindColor = function (k) { return KIND_COLORS[k] || KIND_COLORS.other; };

  /* Members of a Blueprint-defined struct are stored as
     `Name_<index>_<32 hex guid>` so that renames stay stable on disk. The editor
     shows only the leading name, and so does this. */
  var MEMBER_GUID = /_\d+_[0-9A-Fa-f]{32}$/;
  function cleanName(raw) {
    return raw == null ? raw : String(raw).replace(MEMBER_GUID, '');
  }
  UA.cleanName = cleanName;

  /* "Add_DoubleDouble" -> "Add", "K2_SetActorLocation" -> "Set Actor Location" */
  function prettify(raw) {
    if (!raw) return '';
    var s = cleanName(String(raw));
    s = s.replace(/^K2_/, '').replace(/^BP_/, '');
    s = s.replace(/_(DoubleDouble|FloatFloat|IntInt|VectorVector|Int64Int64|ByteByte|VectorFloat|VectorDouble|LinearColorLinearColor)$/i, '');
    s = s.replace(/_/g, ' ');
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return s.replace(/\s+/g, ' ').trim();
  }
  UA.prettify = prettify;

  function memberName(map, key) {
    var p = map[key];
    if (!p) return null;
    var v = UA.structField(p.value, 'MemberName');
    if (v && v.k === 'name') return v.v;
    if (typeof v === 'string') return v;
    return null;
  }
  function objName(pkg, map, key) {
    var pi = UA.propObjIndex(map, key);
    return pi ? pkg.indexName(pi) : null;
  }

  /* Some nodes carry their subject only as a pin default (an asset reference
     picked in the details panel), not as a property on the node itself. */
  function pinDefault(pins, name) {
    if (!pins) return null;
    for (var i = 0; i < pins.length; i++) {
      if (pins[i].name === name && pins[i].defaultValue) return pins[i].defaultValue;
    }
    return null;
  }

  function delegateName(map) {
    return memberName(map, 'DelegateReference') || memberName(map, 'EventReference');
  }

  var FLOW_NODES = {
    K2Node_IfThenElse: 'Branch',
    K2Node_ExecutionSequence: 'Sequence',
    K2Node_MultiGate: 'MultiGate',
    K2Node_DoOnce: 'Do Once',
    K2Node_Select: 'Select',
    K2Node_TemporaryVariable: 'Temporary Variable',
    K2Node_Knot: 'Reroute',
    K2Node_MakeArray: 'Make Array',
    K2Node_MakeMap: 'Make Map',
    K2Node_MakeSet: 'Make Set',
    K2Node_Self: 'Self',
    K2Node_FormatText: 'Format Text'
  };

  /**
   * @param {Package} pkg
   * @param {Object} obj  { export, props: { map } }
   * @returns {{title:string, subtitle:?string, kind:string, compact:boolean}}
   */
  UA.describeNode = function (pkg, obj, pins) {
    var e = obj.export, map = obj.props.map, cls = e.className || 'Node';
    var out = { title: prettify(cls.replace(/^K2Node_/, '')), subtitle: null, kind: 'other', compact: false };

    switch (cls) {
      case 'K2Node_CallFunction':
      case 'K2Node_CallArrayFunction':
      case 'K2Node_CallDataTableFunction':
      case 'K2Node_CallMaterialParameterCollectionFunction': {
        var fn = memberName(map, 'FunctionReference');
        out.title = fn ? prettify(fn) : 'Call Function';
        var owner = map.FunctionReference && UA.structField(map.FunctionReference.value, 'MemberParent');
        if (owner && owner.k === 'obj' && owner.pi) out.subtitle = 'Target is ' + prettify(owner.name);
        out.kind = UA.propBool(map, 'bIsPureFunc', false) || UA.propBool(map, 'bDefaultsToPureFunc', false) ? 'pure' : 'function';
        break;
      }
      case 'K2Node_CallParentFunction': {
        var pf = memberName(map, 'FunctionReference');
        out.title = 'Parent: ' + (pf ? prettify(pf) : 'Function');
        out.kind = 'function';
        break;
      }
      case 'K2Node_PromotableOperator': {
        var op = UA.propString(map, 'OperationName') || memberName(map, 'FunctionReference');
        out.title = op ? prettify(op) : 'Operator';
        out.kind = 'pure';
        break;
      }
      case 'K2Node_VariableGet': {
        var vg = memberName(map, 'VariableReference');
        out.title = vg ? 'Get ' + prettify(vg) : 'Get Variable';
        out.kind = 'variableGet';
        break;
      }
      case 'K2Node_VariableSet': {
        var vs = memberName(map, 'VariableReference');
        out.title = vs ? 'Set ' + prettify(vs) : 'Set Variable';
        out.kind = 'variableSet';
        break;
      }
      case 'K2Node_StructMemberGet': case 'K2Node_StructMemberSet': {
        var sv = memberName(map, 'VariableReference');
        out.title = (cls.indexOf('Get') > 0 ? 'Get ' : 'Set ') + (sv ? prettify(sv) : 'Member');
        out.kind = cls.indexOf('Get') > 0 ? 'variableGet' : 'variableSet';
        break;
      }
      case 'K2Node_Event': {
        var ev = memberName(map, 'EventReference');
        out.title = ev ? 'Event ' + prettify(ev) : 'Event';
        out.kind = 'event';
        break;
      }
      case 'K2Node_CustomEvent': {
        out.title = UA.propString(map, 'CustomFunctionName') || 'Custom Event';
        out.title = prettify(out.title);
        out.subtitle = 'Custom Event';
        out.kind = 'event';
        break;
      }
      case 'K2Node_ComponentBoundEvent': {
        var dn = UA.propString(map, 'DelegatePropertyName');
        var cn = UA.propString(map, 'ComponentPropertyName');
        out.title = dn ? prettify(dn) : 'Bound Event';
        if (cn) out.subtitle = prettify(cn);
        out.kind = 'event';
        break;
      }
      case 'K2Node_ActorBoundEvent': {
        out.title = prettify(UA.propString(map, 'DelegatePropertyName') || 'Actor Bound Event');
        out.kind = 'event';
        break;
      }
      case 'K2Node_InputAction':
        out.title = prettify(UA.propString(map, 'InputActionName') || 'Input Action');
        out.kind = 'event';
        break;
      case 'K2Node_InputKey':
        out.title = 'Input Key';
        out.kind = 'event';
        break;
      case 'K2Node_EnhancedInputAction': {
        var ia = objName(pkg, map, 'InputAction') || pinDefault(pins, 'InputAction');
        out.title = ia && ia !== 'None' ? ia : 'Enhanced Input Action';
        out.subtitle = 'Enhanced Input Action';
        out.kind = 'event';
        break;
      }
      case 'K2Node_EnhancedInputActionValue': {
        var iav = objName(pkg, map, 'InputAction') || pinDefault(pins, 'InputAction');
        out.title = 'Get ' + (iav && iav !== 'None' ? iav : 'Input Action Value');
        out.kind = 'pure';
        break;
      }
      case 'K2Node_Message': {
        var msg = memberName(map, 'FunctionReference');
        out.title = msg ? prettify(msg) : 'Interface Message';
        out.subtitle = 'Message';
        out.kind = 'function';
        break;
      }
      case 'K2Node_CommutativeAssociativeBinaryOperator': {
        var cop = memberName(map, 'FunctionReference');
        out.title = cop ? prettify(cop) : 'Operator';
        out.kind = 'pure';
        break;
      }
      case 'K2Node_CreateWidget':
        out.title = 'Create Widget';
        out.kind = 'function';
        break;
      case 'K2Node_PlayMontage':
        out.title = 'Play Montage';
        out.kind = 'function';
        break;
      case 'K2Node_GetDataTableRow':
        out.title = 'Get Data Table Row';
        out.kind = 'function';
        break;
      case 'K2Node_GetArrayItem':
        out.title = 'Get';
        out.kind = 'pure';
        break;
      case 'K2Node_AddDelegate':
        out.title = 'Bind Event to ' + prettify(delegateName(map) || 'Event');
        out.kind = 'function';
        break;
      case 'K2Node_RemoveDelegate':
        out.title = 'Unbind Event from ' + prettify(delegateName(map) || 'Event');
        out.kind = 'function';
        break;
      case 'K2Node_ClearDelegate':
        out.title = 'Unbind All Events from ' + prettify(delegateName(map) || 'Event');
        out.kind = 'function';
        break;
      case 'K2Node_CallDelegate':
        out.title = 'Call ' + prettify(delegateName(map) || 'Event');
        out.kind = 'function';
        break;
      case 'K2Node_AssignDelegate':
        out.title = 'Assign ' + prettify(delegateName(map) || 'Event');
        out.kind = 'function';
        break;
      case 'K2Node_CreateDelegate':
        out.title = 'Create Event';
        out.kind = 'pure';
        break;
      case 'K2Node_EnumLiteral':
        out.title = 'Literal Enum';
        out.kind = 'pure';
        break;
      case 'K2Node_VariableSetRef':
        out.title = 'Set by Ref';
        out.kind = 'variableSet';
        break;
      case 'K2Node_LatentGameplayTaskCall':
      case 'K2Node_AsyncAction':
      case 'K2Node_BaseAsyncTask': {
        var an = memberName(map, 'ProxyFactoryFunctionName') ||
                 UA.propString(map, 'ProxyFactoryFunctionName') ||
                 memberName(map, 'FunctionReference');
        out.title = an ? prettify(an) : prettify(cls.replace(/^K2Node_/, ''));
        out.kind = 'function';
        break;
      }
      case 'K2Node_InputAxisEvent':
        out.title = prettify(UA.propString(map, 'InputAxisName') || 'Input Axis');
        out.kind = 'event';
        break;
      case 'K2Node_FunctionEntry': {
        var fe = memberName(map, 'FunctionReference');
        out.title = fe ? prettify(fe) : 'Entry';
        out.subtitle = 'Function Entry';
        out.kind = 'terminal';
        break;
      }
      case 'K2Node_FunctionResult':
        out.title = 'Return Node';
        out.kind = 'terminal';
        break;
      case 'K2Node_Tunnel': {
        var canOut = UA.propBool(map, 'bCanHaveOutputs', false);
        var canIn = UA.propBool(map, 'bCanHaveInputs', false);
        out.title = canOut ? 'Inputs' : (canIn ? 'Outputs' : 'Tunnel');
        out.kind = 'terminal';
        break;
      }
      case 'K2Node_MacroInstance': {
        var ref = map.MacroGraphReference && map.MacroGraphReference.value;
        var g = ref && UA.structField(ref, 'MacroGraph');
        out.title = (g && g.k === 'obj' && g.pi) ? prettify(g.name) : 'Macro';
        out.subtitle = 'Macro';
        out.kind = 'macro';
        out.boundGraph = (g && g.k === 'obj') ? g.pi : 0;
        break;
      }
      case 'K2Node_Composite': {
        var bg = UA.propObjIndex(map, 'BoundGraph');
        out.title = bg ? prettify(pkg.indexName(bg)) : 'Collapsed Graph';
        out.subtitle = 'Collapsed Graph';
        out.kind = 'macro';
        out.boundGraph = bg;
        break;
      }
      case 'K2Node_DynamicCast':
      case 'K2Node_ClassDynamicCast': {
        var tt = objName(pkg, map, 'TargetType');
        out.title = 'Cast To ' + (tt ? prettify(tt) : '?');
        out.kind = 'cast';
        break;
      }
      case 'K2Node_MakeStruct':
      case 'K2Node_BreakStruct': {
        var st = objName(pkg, map, 'StructType');
        out.title = (cls === 'K2Node_MakeStruct' ? 'Make ' : 'Break ') + (st ? prettify(st) : 'Struct');
        out.kind = 'pure';
        break;
      }
      case 'K2Node_SetFieldsInStruct':
        out.title = 'Set members in ' + prettify(objName(pkg, map, 'StructType') || 'Struct');
        out.kind = 'pure';
        break;
      case 'K2Node_AddComponent': {
        var tb = objName(pkg, map, 'TemplateType') || UA.propString(map, 'TemplateBlueprint');
        out.title = 'Add Component' + (tb ? ' ' + prettify(tb) : '');
        out.kind = 'function';
        break;
      }
      case 'K2Node_SpawnActorFromClass':
        out.title = 'Spawn Actor from Class';
        out.kind = 'function';
        break;
      case 'K2Node_Timeline':
        out.title = prettify(UA.propString(map, 'TimelineName') || 'Timeline');
        out.subtitle = 'Timeline';
        out.kind = 'flow';
        break;
      case 'K2Node_SwitchEnum':
        out.title = 'Switch on ' + prettify(objName(pkg, map, 'Enum') || 'Enum');
        out.kind = 'flow';
        break;
      case 'K2Node_SwitchInteger': out.title = 'Switch on Int'; out.kind = 'flow'; break;
      case 'K2Node_SwitchString': out.title = 'Switch on String'; out.kind = 'flow'; break;
      case 'K2Node_SwitchName': out.title = 'Switch on Name'; out.kind = 'flow'; break;
      case 'K2Node_Literal':
        out.title = prettify(objName(pkg, map, 'ObjectRef') || 'Literal');
        out.kind = 'pure';
        break;
      case 'K2Node_GetClassDefaults':
        out.title = 'Get Class Defaults'; out.kind = 'pure'; break;
      case 'EdGraphNode_Comment':
        out.title = UA.propString(map, 'NodeComment') || 'Comment';
        out.kind = 'comment';
        break;
      case 'K2Node_Knot':
        out.title = 'Reroute';
        out.kind = 'knot';
        out.compact = true;
        break;
      default:
        if (FLOW_NODES[cls]) { out.title = FLOW_NODES[cls]; out.kind = 'flow'; }
        else if (/^K2Node_/.test(cls)) {
          out.title = prettify(cls.replace(/^K2Node_/, ''));
          out.kind = UA.propBool(map, 'bIsPureFunc', false) ? 'pure' : 'other';
        }
        break;
    }

    if (FLOW_NODES[cls] && out.kind === 'other') out.kind = 'flow';
    if (!out.title) out.title = prettify(cls);
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);

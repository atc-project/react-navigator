import { Injectable } from '@angular/core';
import { DataService, Technique } from "./data.service";
declare var tinygradient: any; //use tinygradient
// import * as tinygradient from 'tinygradient'
declare var tinycolor: any; //use tinycolor2
// import * as tinycolor from 'tinycolor2';
import * as FileSaver from 'file-saver';
declare var math: any; //use mathjs
import * as globals from './globals'; //global variables

@Injectable()
export class ViewModelsService {

    domain = "mitre-mobile";

    constructor(private dataService: DataService) {

        // attempt to restore viewmodels
        // console.log(this.getCookie("viewModels"))
        // this.saveViewModelsCookies()
    }

    viewModels: ViewModel[] = [];
    /**
     * Create and return a new viewModel
     * @param {string} name the viewmodel name
     * @return {ViewModel} the created ViewModel
     */
    newViewModel(name: string) {
        let vm = new ViewModel(name, this.domain, "vm"+ this.getNonce());
        this.viewModels.push(vm);
        // console.log("created new viewModel", this.viewModels)

        // this.saveViewModelsCookies()
        return vm;
    }

    nonce: number = 0;
    /**
     * Get a nonce.
     * @return a number that will never be regenerated by sequential calls to getNonce.
     *         Note: this applies on a session-by-session basis, nonces are not
     *         unique between app instances.
     */
    getNonce(): number {
        return this.nonce++;
    }



    /**
     * Destroy the viewmodel completely Nessecary if tab is closed!
     * @param vm viewmodel to destroy.
     */
    destroyViewModel(vm: ViewModel): void {
        for (let i = 0; i < this.viewModels.length; i++) {
            if (this.viewModels[i] == vm) {
                // console.log("destroying viewmodel", vm)
                this.viewModels.splice(i,1)
                return;
            }
        }
    }

    /**
     * layer combination operation
     * @param  scoreExpression math expression of score expression
     * @param  scoreVariables  variables in math expression, mapping to viewmodel they correspond to
     * @param  comments           what viewmodel to inherit comments from
     * @param  coloring           what viewmodel to inherit manual colors from
     * @param  enabledness        what viewmodel to inherit state from
     * @param  layerName          new layer name
     * @param  filters            viewmodel to inherit filters from
     * @return                    new viewmodel inheriting above properties
     */
    layerLayerOperation(scoreExpression: string, scoreVariables: Map<string, ViewModel>, comments: ViewModel, coloring: ViewModel, enabledness: ViewModel, layerName: string, filters: ViewModel, legendItems: ViewModel): ViewModel {
        let result = new ViewModel("layer by operation", this.domain, "vm" + this.getNonce());

        if (scoreExpression) {
            scoreExpression = scoreExpression.toLowerCase() //should be enforced by input, but just in case
            //Build maps
            let index = 0;
            let indexToTechniqueVM = new Map<number, TechniqueVM>();
            let techniqueIDToIndex = new Map<string, number>();
            // assign unique integer ID to each score varaible technique
            scoreVariables.forEach(function(vm, key) {
                vm.techniqueVMs.forEach(function(tvm, key) {
                    if (!techniqueIDToIndex.has(tvm.techniqueID)) {
                        indexToTechniqueVM.set(index, tvm)
                        techniqueIDToIndex.set(tvm.techniqueID, index);
                        index += 1;
                    }
                })
                // techniqueList.forEach(function(technique) {
                //     console.log(technique)
                //     if (!techniqueIDToIndex.has(technique.technique_id)) {
                //         indexToTechnique.set(index, technique)
                //         techniqueIDToIndex.set(technique.technique_id, index);
                //         index += 1;
                //     }
                // });
            });

            // console.log(techniqueIDToIndex, indexToTechniqueVM)

            let scope = {};
            // build arrays where each index is mapped to a specific techniqueVM.
            // build scope for mathjs

            let missingTechniques = new Map<string, number>(); //count of how many viewModels are missing each technique
            let countMissingTechnique = function(techniqueID) {
                if (missingTechniques.has(techniqueID)) {
                    let value = missingTechniques.get(techniqueID)
                    value++;
                    missingTechniques.set(techniqueID, value)
                } else {
                    missingTechniques.set(techniqueID, 1)
                }
            }

            scoreVariables.forEach(function(vm, key) {
                let scoreArray = [];
                for (let i = 0; i < index; i++) {
                    let scoreValue: number;
                    // parse weird possible values. All non-numbers become 0. Count empty scores so that if all vms have no score it can omit them
                    if (!vm.hasTechniqueVM(indexToTechniqueVM.get(i).techniqueID)) {
                        scoreValue = 0;
                        // console.log(vm, "doesn't have TVM", indexToTechniqueVM.get(i));
                        countMissingTechnique(indexToTechniqueVM.get(i).techniqueID);
                    } else {
                        let storedValue = vm.getTechniqueVM(indexToTechniqueVM.get(i).techniqueID).score;
                        if (storedValue == "") {
                            // console.log("empty score",  indexToTechniqueVM.get(i))
                            scoreValue = 0;
                            countMissingTechnique(indexToTechniqueVM.get(i).techniqueID);
                        } else if (isNaN(Number(storedValue))) {
                            // console.log("NaN score:", storedValue, indexToTechniqueVM.get(i))
                            scoreValue = 0;
                            countMissingTechnique(indexToTechniqueVM.get(i).techniqueID);
                        } else {
                            scoreValue = Number(storedValue);
                        }
                    }
                    scoreArray[i] = scoreValue;
                }
                scope[key] = scoreArray;
            });

            // console.log(scoreExpression, scope)

            //evaluate math
            let mathResult = math.eval(scoreExpression, scope);

            // console.log(scoreExpression, "(",scoreVariables,")", "->", scope, "->", mathResult)
            if (! (typeof(mathResult) === "number")) { //had defined variables, applies uniqely to tvms
                // console.log("matrix result")
                // assign the reult to new viewmodel
                for (let i = 0; i < mathResult.length; i++) {
                    let techniqueVM = indexToTechniqueVM.get(i);
                    let vm = new TechniqueVM(techniqueVM.techniqueID);
                    if (typeof(mathResult[i]) === "boolean") {
                        mathResult[i] = mathResult[i] ? "1" : "0"; //parse booleans to binary
                        result.gradient.maxValue = 1;
                        result.gradient.minValue = 0;
                        result.gradient.setGradientPreset("whiteblue");
                    }
                    vm.score = String(mathResult[i])

                    result.setTechniqueVM(vm)
                }
            } else { //evaulated to single number: apply number to all tvms
                if (typeof(mathResult) === "boolean") {
                    mathResult = mathResult ? "1" : "0";  //parse booleans to binary
                    result.gradient.maxValue = 1;
                    result.gradient.minValue = 0;
                    result.gradient.setGradientPreset("whiteblue");
                }
                // console.log("non-matrix result")
                indexToTechniqueVM.forEach(function(tvm, index) {
                    let new_tvm = new TechniqueVM(tvm.techniqueID);
                    new_tvm.score = mathResult;
                    result.setTechniqueVM(new_tvm);

                })
            }

            missingTechniques.forEach(function(count, techniqueID) {
                // console.log(result.getTechniqueVM(techniqueID).techniqueName, count)
                if (count == scoreVariables.size) {
                    // enough misses that this technique had no score in any viewmodels
                    result.getTechniqueVM(techniqueID).score = "";
                }
            })
        }


        /**
         * Inherit a field from a vm
         * @param  {ViewModel} inherit_vm the viewModel to inherit from
         * @param  {string}    fieldname  the field to inherit from the viewmodel
         */
        function inherit(inherit_vm: ViewModel, fieldname: string) {
            // console.log("inherit", fieldname)
            inherit_vm.techniqueVMs.forEach(function(inherit_TVM) {
                let tvm = result.hasTechniqueVM(inherit_TVM.techniqueID) ? result.getTechniqueVM(inherit_TVM.techniqueID) : new TechniqueVM(inherit_TVM.techniqueID)
                tvm[fieldname] = inherit_TVM[fieldname];
                // console.log(inherit_TVM.techniqueName, "->", tvm)
                result.techniqueVMs.set(inherit_TVM.techniqueID, tvm);
            })
        }

        if (comments)    inherit(comments, "comment")
        if (coloring)    inherit(coloring, "color")
        if (enabledness) inherit(enabledness, "enabled")

        if (filters) { //copy filter settings
            result.filters = JSON.parse(JSON.stringify(filters.filters))
        }

        if (legendItems) {
            result.legendItems = JSON.parse(JSON.stringify(legendItems.legendItems));
        }

        result.name = layerName;
        // console.log(result)
        this.viewModels.push(result)
        result.updateGradient();
        return result;
    } //end layer layer operation
}



/**
 * Gradient class used by viewmodels
 */
export class Gradient {
    //official colors used in gradients:

    colors: Gcolor[] = [new Gcolor("red"), new Gcolor("green")]; //current colors
    // options: string[] = ["white", "red", "orange", "yellow", "green", "blue", "purple"]; //possible colors
    options: string[] = ["#ffffff", "#ff6666", "#ffaf66","#ffe766", "#8ec843", "#66b1ff", "#ff66f4"]; //possible colors
    minValue: number = 0;
    maxValue: number = 100;
    gradient: any;
    gradientRGB: any;

    /**
     * Create a string version of this gradient
     * @return string version of gradient
     */
    serialize(): string {
        let colorList: string[] = [];
        let self = this;
        this.colors.forEach(function(gColor: Gcolor) {
            let hexstring = (tinycolor(gColor.color).toHexString())
            colorList.push(hexstring)
        });

        let rep = {
                "colors": colorList,
                "minValue": this.minValue,
                "maxValue": this.maxValue,
              }
        return JSON.stringify(rep, null, "\t")
    }

    /**
     * Restore this gradient from the given serialized representation
     * @param  rep serialized gradient
     */
    deSerialize(rep: string): void {
        let obj = JSON.parse(rep)
        let isColorStringArray = function(check): boolean {
            for (let i = 0; i < check.length; i++) {
                if (typeof(check[i]) !== "string" || !tinycolor(check[i]).isValid()) {
                    console.error("TypeError:", check[i], "(",typeof(check[i]),")", "is not a color-string")
                    return false;
                }
            }
            return true;
        }


        if (isColorStringArray(obj.colors)) {
            this.colors = []
            let self = this;
            obj.colors.forEach(function(hex: string) {
                self.colors.push(new Gcolor(hex));
            });
        } else console.error("TypeError: gradient colors field is not a color-string[]")
        this.minValue = obj.minValue;
        this.maxValue = obj.maxValue;
        this.updateGradient();
    }

    //presets in dropdown menu
    presets = {
        redgreen: [new Gcolor("#ff6666"), new Gcolor("#ffe766"), new Gcolor("#8ec843")],
        greenred: [new Gcolor("#8ec843"), new Gcolor("#ffe766"), new Gcolor("#ff6666")],
        bluered: [new Gcolor("#66b1ff"), new Gcolor("#ff66f4"), new Gcolor("#ff6666")],
        redblue: [new Gcolor("#ff6666"), new Gcolor("#ff66f4"), new Gcolor("#66b1ff")],
        whiteblue: [new Gcolor("#ffffff"), new Gcolor("#66b1ff")],
        whitered: [new Gcolor("#ffffff"), new Gcolor("#ff6666")]
    }

    /**
     * Convert a preset to tinycolor array
     * @param  preset preset name from preset array
     * @return        [description]
     */
    presetToTinyColor(preset) {
        let colorarray = []
        let self = this;
        this.presets[preset].forEach(function(gcolor: Gcolor) {
            colorarray.push(gcolor.color);
        });
        return tinygradient(colorarray).css('linear', 'to right');
    }

    constructor() { this.setGradientPreset('redgreen'); }

    /**
     * set this gradient to use the preset
     * @param  preset preset to use
     */
    setGradientPreset(preset: string): void {
        this.colors = this.presets[preset];
        this.updateGradient();
    }

    /**
     * recompute gradient
     */
    updateGradient(): void {
        console.log("update gradient")
        let colorarray = [];
        let self = this;
        this.colors.forEach(function(colorobj) {
            // figure out what kind of color this is
            // let format = tinycolor(colorobj.color).getFormat();
            // if (format == "name" && colorobj.color in self.labelToColor)
            colorarray.push(colorobj.color)
        });
        this.gradient = tinygradient(colorarray);
        this.gradientRGB = this.gradient.rgb(100);
    }

    /**
     * Add a color to the end of the gradient
     */
    addColor(): void {
        this.colors.push(new Gcolor(this.colors[this.colors.length - 1].color));
    }

    /**
     * Remove color at the given index
     * @param index index to remove color at
     */
    removeColor(index): void {
        this.colors.splice(index, 1)
    }

    // get the gradient color for a given value in the scale. Value is string format number
    getColor(valueString: string) {
        if (!this.gradient) this.updateGradient();

        let value: number;
        if (valueString.length == 0) return;
        else value = Number(valueString);

        if (value >= this.maxValue) { return this.gradientRGB[this.gradientRGB.length - 1]; }
        if (value <= this.minValue) { return this.gradientRGB[0]; }
        let index = (value - this.minValue)/(this.maxValue - this.minValue) * 100;
        // console.log(value, "->", index)
        return this.gradientRGB[Math.round(index)];
    }
}
//a color in the gradient
export class Gcolor {color: string; constructor(color: string) {this.color = color}};

//semi-synonymous with "layer"
export class ViewModel {
    constructor(name: string, domain: string, uid: string) {
        this.domain = domain;
        // console.log("INITIALIZING VIEW MODEL FOR DOMAIN: " + this.domain);
        this.filters = new Filter(this.domain);
        this.name = name;
        this.version = globals.layer_version;
        this.uid = uid;
    }
    // PROPERTIES & DEFAULTS

    name: string; // layer name
    domain: string; //layer domain, TODO
    description: string = ""; //layer description
    version: string = "";
    uid: string; //unique identifier for this ViewModel. Do not serialize, let it get initialized by the VmService

    filters: Filter;

    /*
     * sorting int meanings (see data-table.filterTechniques()):
     * 0: ascending alphabetically
     * 1: descending alphabetically
     * 2: ascending numerically
     * 3: descending numerically
     */
    sorting: number = 0;
    /*
     * viewMode int meanings
     * 0: full table
     * 1: compact table (previosly: minitable)
     * 2: mini table
     */
    viewMode: number = 0;


    hideDisabled: boolean = false; //are disabled techniques hidden?

    highlightedTactic: string = "";
    highlightedTechnique: Technique = null;
    hoverTactic: string = "";

    gradient: Gradient = new Gradient(); //gradient for scores

    backgroundPresets: string[] = ['#e60d0d', '#fc3b3b', '#fc6b6b', '#fca2a2', '#e6550d', '#fd8d3c', '#fdae6b', '#fdd0a2', '#e6d60d', '#fce93b', '#fcf26b', '#fcf3a2', '#31a354', '#74c476', '#a1d99b', '#c7e9c0', '#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#756bb1', '#9e9ac8', '#bcbddc', '#dadaeb', '#636363', '#969696', '#bdbdbd', '#d9d9d9'];
    legendColorPresets: string[] = [];

    techniqueIDSelectionLock: boolean = true;

    changeTechniqueIDSelectionLock(){
        this.techniqueIDSelectionLock = !this.techniqueIDSelectionLock;
    }

    showTacticRowBackground: boolean = false;
    tacticRowBackground: string = "#dddddd";

     //  _____ ___ ___ _  _ _  _ ___ ___  _   _ ___     _   ___ ___
     // |_   _| __/ __| || | \| |_ _/ _ \| | | | __|   /_\ | _ \_ _|
     //   | | | _| (__| __ | .` || | (_) | |_| | _|   / _ \|  _/| |
     //   |_| |___\___|_||_|_|\_|___\__\_\\___/|___| /_/ \_\_| |___|

    techniqueVMs: Map<string, TechniqueVM> = new Map<string, TechniqueVM>(); //configuration for each technique
    // Getter
    getTechniqueVM(technique_tactic_union_id: string): TechniqueVM {
        return this.techniqueVMs.get(technique_tactic_union_id)
    }
    // Setter
    setTechniqueVM(techniqueVM: TechniqueVM): void {
        if (this.techniqueVMs.has(techniqueVM.technique_tactic_union_id)) this.techniqueVMs.delete(techniqueVM.technique_tactic_union_id)
        this.techniqueVMs.set(techniqueVM.technique_tactic_union_id, techniqueVM);
    }
    //checker
    hasTechniqueVM(technique_tactic_union_id: string): boolean {
        return this.techniqueVMs.has(technique_tactic_union_id)
    }

    //  ___ ___ ___ _____ ___ _  _  ___     _   ___ ___
    // | __|   \_ _|_   _|_ _| \| |/ __|   /_\ | _ \_ _|
    // | _|| |) | |  | |  | || .` | (_ |  / _ \|  _/| |
    // |___|___/___| |_| |___|_|\_|\___| /_/ \_\_| |___|

    selectedTechniques: string[] = []; //technique_id array of selected techniques

    /**
     * Add a technique to the current selection
     * @param {Technique} technique technique to add
     */
    addToTechniqueSelection(technique: Technique): void {
        if (!this.isTechniqueSelected(technique)) this.selectedTechniques.push(technique.technique_tactic_union_id)

    }

    /**
     * Add a technique to the current selection
     * @param {string} technique_tactic_union_id techniqueID of technique to add
     */
    addToTechniqueSelection_id(technique_tactic_union_id: string): void {
        if (!this.isTechniqueSelected_id(technique_tactic_union_id)) this.selectedTechniques.push(technique_tactic_union_id)
    }

    /**
     * Remove the technique from the current selection
     * @param {Technique} technique technique to remove
     */
    removeFromTechniqueSelection(technique: Technique): void {
        if (this.isTechniqueSelected(technique)) {
            let index = this.selectedTechniques.indexOf(technique.technique_tactic_union_id)
            this.selectedTechniques.splice(index, 1);
        }
    }

    /**
     * Remove the technique from the current selection
     * @param {Technique} technique techniqueID of technique to remove
     */
    removeFromTechniqueSelection_id(technique_tactic_union_id: string): void {
        if (this.isTechniqueSelected_id(technique_tactic_union_id)) {
            let index = this.selectedTechniques.indexOf(technique_tactic_union_id)
            this.selectedTechniques.splice(index, 1);
        }
    }

    /**
     * Replace the current selection of techniques with the given technique
     * @param {Technique} technique technique to replace selection with
     */
    replaceTechniqueSelection(technique: Technique): void {
        this.selectedTechniques = [technique.technique_tactic_union_id]
    }

    /**
     * Unselect all techniques
     */
    clearTechniqueSelection(): void {
        this.selectedTechniques = []
    }

    /**
     * Select all techniques
     */
    selectAllTechniques(): void {
        this.clearTechniqueSelection()
        this.invertSelection();
        // console.log(self.selectedTechniques)
    }

    /**
     * Set all selected techniques to deselected, and select all techniques not currently selected
     */
    invertSelection(): void {
        let backup_selected = JSON.parse(JSON.stringify(this.selectedTechniques)) // deep copy
        let self = this;
        this.clearTechniqueSelection()
        this.techniqueVMs.forEach(function(tvm, key) {
            if (!backup_selected.includes(tvm.technique_tactic_union_id)) self.selectedTechniques.push(tvm.technique_tactic_union_id)
        });
    }

    /**
     * are all techniques currently being edited?
     * @return [description]
     */
    isEditingAllTechniques(): boolean {
        let backup_selected = JSON.stringify(this.selectedTechniques) // deep copy
        this.selectAllTechniques();
        let all = JSON.stringify(this.selectedTechniques) // deep copy
        this.selectedTechniques = JSON.parse(backup_selected);
        return backup_selected == all;
    }

    /**
     * Return true if the given technique is selected, false otherwise
     * @param  {[type]}  technique the technique to check
     * @return {boolean}           true if selected, false otherwise
     */
    isTechniqueSelected(technique): boolean {
        return this.selectedTechniques.includes(technique.technique_tactic_union_id)
    }

    /**
     * Return true if the given technique is selected, false otherwise
     * @param  {string}  technique_tactic_union_id the techniqueID to check
     * @return {boolean}           true if selected, false otherwise
     */
    isTechniqueSelected_id(technique_tactic_union_id: string): boolean {
        return this.selectedTechniques.includes(technique_tactic_union_id)
    }

    /**
     * return the number of selected techniques
     * @return {number} the number of selected techniques
     */
    getSelectedTechniqueCount(): number {
        return this.selectedTechniques.length;
    }

    /**
     * Return true if currently editing any techniques, false otherwise
     * @return {boolean} true if currently editing any techniques, false otherwise
     */
    isCurrentlyEditing(): boolean {
        return this.getSelectedTechniqueCount() > 0;
    }

    /**
     * edit the selected techniques
     * @param {string} field the field to edit
     * @param {any}    value the value to place in the field
     */
    editSelectedTechniques(field: string, value: any): void {
        for (let i = 0; i < this.selectedTechniques.length; i++) {
            let tvm = this.getTechniqueVM(this.selectedTechniques[i]);
            tvm[field] = value;
        }
    }

    /**
     * Reset the selected techniques' annotations to their default values
     */
    resetSelectedTechniques(): void {
        for (let i = 0; i < this.selectedTechniques.length; i++) {
            this.getTechniqueVM(this.selectedTechniques[i]).score = "";
            this.getTechniqueVM(this.selectedTechniques[i]).comment = "";
            this.getTechniqueVM(this.selectedTechniques[i]).color = "";
            this.getTechniqueVM(this.selectedTechniques[i]).enabled = true;
        }
    }

    /**
     * Get get a common value from the selected techniques
     * @param  field the field to get the common value from
     * @return       the value of the field if all selected techniques have the same value, otherwise ""
     */
    getEditingCommonValue(field: string): any {
        if (!this.isCurrentlyEditing()) return "";
        let commonValue = this.getTechniqueVM(this.selectedTechniques[0])[field];
        for (let i = 1; i < this.selectedTechniques.length; i++) {
            if (this.getTechniqueVM(this.selectedTechniques[i])[field] != commonValue) return ""
        }

        return commonValue;
    }



    //  ___ ___ ___ ___   _   _    ___ ____  _ _____ ___ ___  _  _
    // / __| __| _ \_ _| /_\ | |  |_ _|_  / /_\_   _|_ _/ _ \| \| |
    // \__ \ _||   /| | / _ \| |__ | | / / / _ \| |  | | (_) | .` |
    // |___/___|_|_\___/_/ \_\____|___/___/_/ \_\_| |___\___/|_|\_|

    /**
     * stringify this vm
     * @return string representation
     */
    serialize(): string {
        let modifiedTechniqueVMs = []
        let self = this;
        this.techniqueVMs.forEach(function(value,key) {
            if (value.modified()) modifiedTechniqueVMs.push(JSON.parse(value.serialize())) //only save techniqueVMs which have been modified
        })
        let rep: {[k: string]: any } = {};
        rep.name = this.name;
        rep.version = String(this.version);
        rep.domain = this.domain

        rep.description = this.description;
        rep.filters = JSON.parse(this.filters.serialize());
        rep.sorting = this.sorting;
        rep.viewMode = this.viewMode;
        rep.hideDisabled = this.hideDisabled;
        rep.techniques = modifiedTechniqueVMs;
        rep.gradient = JSON.parse(this.gradient.serialize());
        rep.legendItems = JSON.parse(JSON.stringify(this.legendItems));

        rep.showTacticRowBackground = this.showTacticRowBackground;
        rep.tacticRowBackground = this.tacticRowBackground;

        return JSON.stringify(rep, null, "\t");
    }

    /**
     * restore this vm from a string
     * @param  rep string to restore from
     */
    deSerialize(rep: string): void {
        let obj = JSON.parse(rep)
        this.name = obj.name
        this.domain = obj.domain;

        if(obj.version !== globals.layer_version){
            alert("WARNING: Uploaded layer version (" + String(obj.version) + ") does not match Navigator's layer version ("
            + String(globals.layer_version) + "). The layer configuration may not be fully restored.");
        }
        if ("description" in obj) {
            if (typeof(obj.description) === "string") this.description = obj.description;
            else console.error("TypeError: description field is not a string")
        }
        if ("filters" in obj) { this.filters.deSerialize(obj.filters); }
        if ("sorting" in obj) {
            if (typeof(obj.sorting) === "number") this.sorting = obj.sorting;
            else console.error("TypeError: sorting field is not a number")
        }
        if ("viewMode" in obj) {
            if (typeof(obj.viewMode) === "number") this.viewMode = obj.viewMode;
            else console.error("TypeError: viewMode field is not a number")
        }
        if ("hideDisabled" in obj) {
            if (typeof(obj.hideDisabled) === "boolean") this.hideDisabled = obj.hideDisabled;
            else console.error("TypeError: hideDisabled field is not a boolean")
        }

        if ("gradient" in obj) {
            this.gradient = new Gradient();
            this.gradient.deSerialize(JSON.stringify(obj.gradient))
        }

        if ("legendItems" in obj) {
            for (let i = 0; i < obj.legendItems.length; i++) {
                let legendItem = {
                    color: "#defa217",
                    label: "default label"
                };
                if (!("label" in obj.legendItems[i])) {
                    console.error("Error: LegendItem required field 'label' not present")
                    continue;
                }
                if (!("color" in obj.legendItems[i])) {
                    console.error("Error: LegendItem required field 'label' not present")
                    continue;
                }

                if (typeof(obj.legendItems[i].label) === "string") {
                    legendItem.label = obj.legendItems[i].label;
                } else {
                    console.error("TypeError: legendItem label field is not a string")
                    continue
                }

                if (typeof(obj.legendItems[i].color) === "string" && tinycolor(obj.legendItems[i].color).isValid()) {
                    legendItem.color = obj.legendItems[i].color;
                } else {
                    console.error("TypeError: legendItem color field is not a color-string:", obj.legendItems[i].color, "(", typeof(obj.legendItems[i].color),")")
                    continue
                }
                this.legendItems.push(legendItem);
            }
        }

        if ("showTacticRowBackground" in obj) {
            if (typeof(obj.showTacticRowBackground) === "boolean") this.showTacticRowBackground = obj.showTacticRowBackground
            else console.error("TypeError: showTacticRowBackground field is not a boolean")
        }
        if ("tacticRowBackground" in obj) {
            if (typeof(obj.tacticRowBackground) === "string" && tinycolor(obj.tacticRowBackground).isValid()) this.tacticRowBackground = obj.tacticRowBackground;
            else console.error("TypeError: tacticRowBackground field is not a color-string:", obj.tacticRowBackground, "(", typeof(obj.tacticRowBackground),")")
        }

        if ("techniques" in obj) {
            for (let i = 0; i < obj.techniques.length; i++) {
                let tvm = new TechniqueVM("");
                tvm.deSerialize(JSON.stringify(obj.techniques[i]))
                // console.log("deserialized", tvm)
                this.setTechniqueVM(tvm)
            }
        }

        // console.log("finished deserializing", this)
        this.updateGradient();
    }

    /**
     * Add a color to the end of the gradient
     */
    addGradientColor(): void {
        this.gradient.addColor();
        this.updateGradient();
    }

    /**
     * Remove color at the given index
     * @param index index to remove color at
     */
    removeGradientColor(index: number): void {
        this.gradient.removeColor(index)
        this.updateGradient();
    }

    /**
     * Update this vm's gradient
     */
    updateGradient(): void {
        this.gradient.updateGradient();
        let self = this;
        this.techniqueVMs.forEach(function(tvm, key) {
            tvm.scoreColor = self.gradient.getColor(tvm.score);
        });
        this.updateLegendColorPresets();
    }

    legendItems = [

    ];

    addLegendItem(): void {
        var newObj = {
            label: "NewItem",
            color: '#00ffff'
        }
        this.legendItems.push(newObj);
    }

    deleteLegendItem(index: number): void {
        this.legendItems.splice(index,1);
    }

    clearLegend(): void {
        this.legendItems = [];
    }

    updateLegendColorPresets(): void {
        this.legendColorPresets = [];
        for(var i = 0; i < this.backgroundPresets.length; i++){
            this.legendColorPresets.push(this.backgroundPresets[i]);
        }
        for(var i = 0; i < this.gradient.colors.length; i++){
            this.legendColorPresets.push(this.gradient.colors[i].color);
        }
    }

    /**
     * return an acronym version of the given string
     * @param  words the string of words to get the acrnoym of
     * @return       the acronym string
     */
    acronym(words: string): string {
        let skipWords = ["on","and", "the", "with", "a", "an", "of", "in", "for", "from"]

        let result = "";
        let wordSplit = words.split(" ");
        if (wordSplit.length > 1) {
            let wordIndex = 0;
            // console.log(wordSplit);
            while (result.length < 4 && wordIndex < wordSplit.length) {
                if (skipWords.includes(wordSplit[wordIndex].toLowerCase())) {
                    wordIndex++;
                    continue;
                }

                //find first legal char of word
                for (let charIndex = 0; charIndex < wordSplit[wordIndex].length; charIndex++) {
                    let code = wordSplit[wordIndex].charCodeAt(charIndex);
                    if (code < 48 || (code > 57 && code < 65) || (code > 90 && code < 97) || code > 122) { //illegal character
                        continue;
                    } else {
                        result += wordSplit[wordIndex].charAt(charIndex).toUpperCase()
                        break;
                    }
                }

                wordIndex++;
            }

            return result;
        } else {
            return wordSplit[0].charAt(0).toUpperCase();
        }
    }
}

// the viewmodel for a specific technique
export class TechniqueVM {
    techniqueID: string;
    technique_tactic_union_id: string;

    score: string = "";
    scoreColor: any; //color for score gradient

    color: string = ""; //manually assigned color-class name
    enabled: boolean = true;
    comment: string = ""

    //print this object to the console
    print(): void {
        console.log(this.serialize())
        console.log(this)
    }

    /**
     * Has this TechniqueVM been modified from its initialized state?
     * @return true if it has been modified, false otherwise
     */
    modified(): boolean {
        return (this.score != "" || this.color != "" || !this.enabled || this.comment != "");
    }

    /**
     * Convert to string representation
     * @return string representation
     */
    serialize(): string {
        let rep: {[k: string]: any } = {};
        rep.techniqueID = this.techniqueID;
        if (this.score !== "" && !(isNaN(Number(this.score)))) rep.score = Number(this.score);
        rep.color = this.color;
        rep.comment = this.comment;
        rep.enabled = this.enabled;
        rep.technique_tactic_union_id = this.technique_tactic_union_id;

        return JSON.stringify(rep, null, "\t")
    }

    /**
     * Restore this technique from serialized technique
     * @param rep serialized technique string
     */
    deSerialize(rep: string): void {
        let obj = JSON.parse(rep);
        if ("techniqueID" in obj) this.techniqueID = obj.techniqueID;
        else console.error("ERROR: TechniqueID field not present in technique")
        if ("technique_tactic_union_id" in obj) this.technique_tactic_union_id = obj.technique_tactic_union_id;
        else console.error("ERROR: technique_tactic_union_id field not present in technique")
        if ("comment" in obj) {
            if (typeof(obj.comment) === "string") this.comment = obj.comment;
            else console.error("TypeError: technique comment field is not a number:", obj.comment, "(",typeof(obj.comment),")")
        }
        if ("color" in obj && obj.color !== "") {
            if (typeof(obj.color) === "string" && tinycolor(obj.color).isValid()) this.color = obj.color;
            else console.error("TypeError: technique color field is not a color-string:", obj.color, "(", typeof(obj.color),")")
        }
        if ("score" in obj) {
            if (typeof(obj.score) === "number") this.score = String(obj.score);
            else console.error("TypeError: technique score field is not a number:", obj.score, "(", typeof(obj.score), ")")
        }
        if ("enabled" in obj) {
            if (typeof(obj.enabled) === "boolean") this.enabled = obj.enabled;
            else console.error("TypeError: technique enabled field is not a boolean:", obj.enabled, "(", typeof(obj.enabled), ")");
        }
    }

    constructor(technique_tactic_union_id: string) {
        this.technique_tactic_union_id = technique_tactic_union_id;
        this.techniqueID = technique_tactic_union_id.split("^")[0];
    }
}

// the data for a specific filter
export class Filter {
    stages: {
        options: string[]
        selection: string[]
    }
    platforms: {
        options: string[]
        selection: string[]
    }
    constructor(domain) {
        this.stages = {options: ["prepare", "act"], selection: ["act"]}
        // this.stages.selection = ["act"];
        // this.stages.options = ["prepare", "act"];
        if (domain == "mitre-enterprise") {
            this.platforms = {selection: ["windows", "linux", "mac"], options: ["windows", "linux", "mac"]}
        } else if (domain == "mitre-mobile") {
            this.platforms = {selection: ["android", "ios"], options: ["android", "ios"]}

        }
    }

    toggleInFilter(filterName, value): void {
        if (!this[filterName].options.includes(value)) { console.log("not a valid option to toggle", value, this[filterName]); return }
        if (this[filterName].selection.includes(value)) {
            let index = this[filterName].selection.indexOf(value)
            this[filterName].selection.splice(index, 1);
        } else {
            this[filterName].selection.push(value);
        }
    }

    inFilter(filterName, value): boolean {
        return this[filterName].selection.includes(value)
    }

    /**
     * Return the string representation of this filter
     * @return [description]
     */
    serialize(): string {
        return JSON.stringify({"stages": this.stages.selection, "platforms": this.platforms.selection})
    }

    /**
     * Replace the properties of this object with those of the given serialized filter
     * @param rep filter object
     */
    deSerialize(rep: any): void {
        // console.log(rep)
        let isStringArray = function(check): boolean {
            for (let i = 0; i < check.length; i++) {
                if (typeof(check[i]) !== "string") {
                    console.error("TypeError:", check[i], "(",typeof(check[i]),")", "is not a string")
                    return false;
                }

            }
            return true;
        }
        // let obj = JSON.parse(rep);
        if (rep.platforms) {
            if (isStringArray(rep.platforms)) this.platforms.selection = rep.platforms
            else console.error("TypeError: filter platforms field is not a string[]");
        }
        if (rep.stages) {
            if (isStringArray(rep.stages)) this.stages.selection = rep.stages
            else console.error("TypeError: filter stages field is not a string[]");

        }
    }
}

import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {Form} from '../../form/form';
import {FormFactory} from '../../form/form-factory';
import {SettingsBus} from '../../providers/settings-bus';
import {Settings} from '../../interfaces/settings';
import {ViewMode} from '../../enums/view-mode';
import {InteractionOptions} from '../../enums/interaction-options';
import {FormComponent} from "../form/form.component";

@Component({
    selector: 'app-general-settings-button',
    templateUrl: './general-settings-button.component.html',
})
export class GeneralSettingsButtonComponent implements OnInit {
    /** @author Bart Wesselink */
    private storageKey = 'General-settings';

    public form: Form;
    public view: boolean = false;
    @ViewChild('formComponent') private formComponent: FormComponent;

    constructor(private formFactory: FormFactory, private settingsBus: SettingsBus) {
    }

    public toggle(): void {
        this.view = !this.view;
    }

    public ngOnInit(): void {
        this.createForm();

        // get stored settings (if any)
        this.fetchPersistentSettings();
        // emit first value
        this.updateValue();
    }

    public close(): void {
        this.view = false;
    }

    public updateValue(): void {
        this.settingsBus.updateSettings(this.form.getFormGroup().value as Settings);
        localStorage.setItem(this.storageKey, JSON.stringify(this.form.getFormGroup().value)); // store updated values
    }

    private createForm(): void {
        this.form = this.formFactory
            .createFormBuilder()
            .addToggleField('darkMode', false, { label: 'Dark mode' })
            .addToggleField('grid', true, { label: 'Show grid' })
            .addChoiceField('viewMode', ViewMode.SIDE_BY_SIDE, { label: 'View mode', expanded: true, choices: { sideBySide: 'Side by side', tab: 'Tabs' } })
            .addChoiceField('interactionSettings', InteractionOptions.ZoomAndPan, {
                label: 'Action on clicking a node',
                choices:{
                    '0': 'Zoom and pan to the node',
                    '1': 'Pan to the node',
                    '2': 'Do nothing'
                },
                expanded: false
            })
            /** @author Nico Klaassen */
            .addToggleField('colorMode', true, {label: 'Color mode'})
            .addChoiceField('palette', 'defaultBlue', {label: 'Color palette', expanded: false, choices:
                    {defaultBlue: 'NGL Blue',
                        longRed: 'Min-max Red',
                        longGreen: 'Min-max Green',
                        longBlue: 'Min-max Blue',
                        longGrey: 'Min-max Greyscale',
                        redBlue: 'Red and Blue',
                        greyScale: 'Greyscale',
                        vaporWave: 'Vaporwave',
                        malachite: 'Malachite',
                        candy: 'Candy',
                        goldenBlue: 'Golden Blue',
                        neon: 'Neon',
                        purpleOrange: 'Purple & Orange'}})
            .addToggleField('reversePalette', false, {label: 'Reverse palette colors'})
            /** @end-author Nico Klaassen */
            /** @author Jules Cornelissen */
            .addToggleField('gradientMapType', true, {label: 'Gradient per subtree'})
            .addChoiceField('gradientType', '1', {label: 'Gradient type', expanded: false, choices: {'1': 'RGB linear', '2': 'HSV'}})
            .addToggleField('invertHSV', false, {label: 'Invert HSV gradient'})
            /** @end-author Jules Cornelissen */

            .getForm();
    }
    /** @end-author Bart Wesselink */

    /** @author Mathijs Boezer */
    private fetchPersistentSettings(): void {
        if (localStorage.getItem(this.storageKey)) { // uses defaults if nothing is saved
            try {
                this.loadSetting(JSON.parse(localStorage.getItem(this.storageKey)));
            } catch {
                console.error("Settings in storage do not correspond to expected format."); // when more settings get added this will show once
            }
        }
    }

    private loadSetting(setting: Settings): void {
        this.form.getFormGroup().setValue(setting);
    }

    public resetDefault(): void {
        this.createForm();
        this.updateValue();
        setTimeout(() => {
            this.formComponent.ngOnInit(); // rerun init
        });
    }
    /** @end-author Mathijs Boezer */
}

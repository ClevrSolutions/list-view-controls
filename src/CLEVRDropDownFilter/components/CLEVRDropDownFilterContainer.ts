import { Component, ReactChild, ReactNode, createElement } from "react";
import * as classNames from "classnames";

import { Alert } from "../../Shared/components/Alert";
import { DataSourceHelper, DataSourceHelperListView } from "../../Shared/DataSourceHelper/DataSourceHelper";
import { SharedUtils, WrapperProps } from "../../Shared/SharedUtils";
import { Validate } from "../Validate";

import { DropDownFilter } from "./CLEVRDropDownFilter";
import { SharedContainerUtils } from "../../Shared/SharedContainerUtils";
import { FormViewState } from "../../Shared/FormViewState";

import "../ui/CLEVRDropDownFilter.scss";

export interface ContainerProps extends WrapperProps {
    entity: string;
    filters: FilterProps[];
    multiselect: boolean;
    multiselectPlaceholder: string;
    sortOptions: sortOptionsOpt;
}

export interface FilterProps {
    caption: string;
    filterBy: filterOptions;
    attribute: string;
    attributeValue: string;
    constraint: string;
    referenceConstraint: string;
    isDefault: boolean;
}

export type filterOptions = "none" | "attribute" | "XPath";

export type sortOptionsOpt = "no" | "asc" | "desc";

export interface ContainerState {
    alertMessage?: ReactChild;
    listViewAvailable: boolean;
    targetListView?: DataSourceHelperListView;
    selectedOption: FilterProps;
}

interface FormState {
    selectedOption?: FilterProps;
}

export default class DropDownFilterContainer extends Component<ContainerProps, ContainerState> {
    private dataSourceHelper?: DataSourceHelper;
    private widgetDom: Element | null = null;
    private viewStateManager: FormViewState<FormState>;
    private retriesFind = 0;

    constructor(props: ContainerProps) {
        super(props);

        this.applyFilter = this.applyFilter.bind(this);
        this.viewStateManager = new FormViewState(this.props.mxform, this.props.uniqueid, viewState => {
            viewState.selectedOption = this.state.selectedOption;
        });

        this.state = {
            alertMessage: Validate.validateProps(this.props),
            listViewAvailable: false,
            selectedOption: this.getInitialStateSelectedOption()
        };
    }

    render() {
        return createElement("div",
            {
                className: classNames("widget-drop-down-filter", this.props.class),
                ref: (widgetDom: HTMLElement) => this.widgetDom = widgetDom,
                style: SharedUtils.parseStyle(this.props.style)
            },
            this.renderAlert(),
            this.renderDropDownFilter()
        );
    }

    componentDidMount() {
        SharedUtils.delay(this.connectToListView.bind(this), this.checkListViewAvailable.bind(this), 20);
    }

    componentWillReceiveProps(nextProps: ContainerProps) {
        if (this.state.listViewAvailable) {
            this.setState({ alertMessage: Validate.validateProps(nextProps) });
        }
    }

    componentDidUpdate(prevProps: ContainerProps, prevState: ContainerState) {
        if (this.state.listViewAvailable && !prevState.listViewAvailable) {
            const restoreState = this.checkRestoreState();
            this.applyFilter(this.state.selectedOption, restoreState);
        } else if (this.state.listViewAvailable && this.props.mxObject !== prevProps.mxObject) {
            const hasContext = this.state.selectedOption.constraint.indexOf(`'[%CurrentObject%]'`) !== -1;
            if (hasContext) {
                this.applyFilter(this.state.selectedOption);
            }
        }
    }

    componentWillUnmount() {
        this.viewStateManager.destroy();
    }

    private checkListViewAvailable(): boolean {
        if (!this.widgetDom) {
            return false;
        }
        this.retriesFind++;
        if (this.retriesFind > 25) {
            return true; // Give-up searching
        }
        return !!SharedContainerUtils.findTargetListView(this.widgetDom.parentElement, this.props.entity);
    }

    private renderAlert(): ReactNode {
        return createElement(Alert, {
            className: "widget-checkbox-filter-alert"
        }, this.state.alertMessage);
    }

    private renderDropDownFilter(): ReactNode {
        if (!this.state.alertMessage) {
            const selectedCaption = this.state.selectedOption && this.state.selectedOption.caption;
            const defaultFilterIndex = this.props.filters.map(value => value.caption).indexOf(selectedCaption);
            const filters: FilterProps[] = JSON.parse(JSON.stringify(this.props.filters));
            const multiselect = this.props.multiselect;
            const multiselectPlaceholder = this.props.multiselectPlaceholder;
            const sortOptions = this.props.sortOptions;

            if (this.props.mxObject) {
                filters.forEach(filter => {
                    filter.constraint = filter.constraint.replace(/\[%CurrentObject%\]/g, this.props.mxObject.getGuid());
                    filter.referenceConstraint = filter.referenceConstraint.replace(/\[%CurrentObject%\]/g, this.props.mxObject.getGuid());
                });
            }

            const requiresContext = filters.find( f => f.referenceConstraint.indexOf(`'[%CurrentObject%]'`) !== -1) != null;

            if (requiresContext && this.props.mxObject==null) {
                return null;
            }
            return createElement(DropDownFilter, {
                defaultFilterIndex,
                filters,
                multiselect,
                multiselectPlaceholder,
                handleChange: this.applyFilter,
                ctxObject: this.props.mxObject,
                sortOptions,
            });
        }

        return null;
    }

    private checkRestoreState(): boolean {
        return this.viewStateManager.getPageState("selectedOption") !== undefined;
    }

    private getInitialStateSelectedOption(): FilterProps {
        if (this.props.multiselect) {
            const defaultFilter = this.props.filters.filter(value => value.isDefault)[0] ||
            // Use filter none for multiselect default filter is no default is set
            { filterBy: "none", caption: "", attribute: "", attributeValue: "", constraint: "", referenceConstraint: "", isDefault: false };

            return this.viewStateManager.getPageState("selectedOption", defaultFilter);
        } else {
            const defaultFilter = this.props.filters.filter(value => value.isDefault)[0] || this.props.filters[0];

            return this.viewStateManager.getPageState("selectedOption", defaultFilter);
        }
    }

    private applyFilter(selectedFilter: FilterProps | FilterProps[], restoreState = false) {
        if (Array.isArray(selectedFilter)) {
            const constraint = "[" +
            selectedFilter
            .map(filter => this.getConstraint(filter))
            .map(sc => {
                if (typeof sc === "string") {
                    const first = sc.indexOf("[");
                    const last = sc.lastIndexOf("]");
                    return "(" + sc.substring(first + 1, last) + ")";
                } else {
                    return "";
                }
            })
            .join(" or ") + "]";
            if (this.dataSourceHelper) {
                mx.logger.debug(this.props.uniqueid, "applyFilter", constraint);
                this.dataSourceHelper.setConstraint(this.props.uniqueid, constraint, undefined, restoreState);
            }
        } else {
            const constraint = this.getConstraint(selectedFilter);
            if (this.dataSourceHelper) {
                mx.logger.debug(this.props.uniqueid, "applyFilter", constraint);
                this.dataSourceHelper.setConstraint(this.props.uniqueid, constraint, undefined, restoreState);
            }
            this.setState({ selectedOption: selectedFilter });
        }
    }

    private getConstraint(selectedFilter: FilterProps): string | mendix.lib.dataSource.OfflineConstraint {
        const { targetListView } = this.state;
        const { attribute, filterBy, constraint, attributeValue } = selectedFilter;

        if (targetListView) {
            const mxObjectId = this.props.mxObject ? this.props.mxObject.getGuid() : "";
            const hasContext = constraint.indexOf(`'[%CurrentObject%]'`) !== -1;

            if (filterBy === "XPath" && hasContext && mxObjectId) {
                return constraint.replace(/\'\[%CurrentObject%\]\'/g, mxObjectId);
            } else if (filterBy === "XPath" && !hasContext) {
                return constraint;
            } else if (filterBy === "attribute" && attributeValue) {
                return this.getAttributeConstraint(attribute, attributeValue);
            }
        }
        return "";
    }

    private getAttributeConstraint(attribute: string, attributeValue: string): string | mendix.lib.dataSource.OfflineConstraint {
        const { targetListView } = this.state;
        if (window.mx.isOffline()) {
            const constraints: mendix.lib.dataSource.OfflineConstraint = {
                attribute,
                operator: "contains",
                path: this.props.entity,
                value: attributeValue
            };

            return constraints;
        }

        if (targetListView && targetListView._datasource && attributeValue) {
            const entityMeta = mx.meta.getEntity(this.props.entity);

            if (entityMeta.isEnum(attribute)) {
                return `[${attribute}='${attributeValue}']`;
            } else if (entityMeta.isBoolean(attribute)) {
                return `[${attribute} = '${attributeValue.toLowerCase()}']`;
            } else {
                return `[contains(${attribute},'${attributeValue}')]`;
            }
        }

        return "";
    }

    private connectToListView() {
        let errorMessage = "";
        let targetListView: DataSourceHelperListView | undefined;

        try {
            this.dataSourceHelper = DataSourceHelper.getInstance(this.widgetDom, this.props.entity);
            targetListView = this.dataSourceHelper.getListView();
        } catch (error) {
            errorMessage = error.message;
        }

        if (errorMessage && targetListView) {
            DataSourceHelper.showContent(targetListView.domNode);
        }

        this.setState({
            alertMessage: errorMessage || Validate.validateProps(this.props),
            listViewAvailable: !!targetListView,
            targetListView
        });
    }

}

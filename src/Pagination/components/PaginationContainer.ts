import { Component, ReactChild, ReactElement, createElement } from "react";
import * as classNames from "classnames";
import * as mendixLang from "mendix/lang";
import * as dojoAspect from "dojo/aspect";
import * as dojoTopic from "dojo/topic";

import { Alert } from "../../Shared/components/Alert";
import { ListView, SharedUtils, paginationTopicSuffix } from "../../Shared/SharedUtils";
import { SharedContainerUtils } from "../../Shared/SharedContainerUtils";

import {
    getListNode, hideLoadMoreButton, hideLoader, mxTranslation,
    resetListViewStructure, setListNodeToEmpty, showLoadMoreButton, showLoader
} from "../utils/ContainerUtils";

import { ModelerProps, TopicMessage, UpdateSourceType } from "../Pagination";
import { OnChangeProps } from "./PageSizeSelect";
import { Pagination, PaginationProps } from "./Pagination";
import { Validate } from "../Validate";

import "../ui/Pagination.scss";

interface PaginationContainerState {
    findingListViewWidget: boolean;
    listViewSize: number;
    message: ReactChild;
    pageSize: number;
    hideUnusedPaging: boolean;
    isLoadingItems: boolean;
    publishedOffset?: number;
    publishedPageNumber?: number;
    pendingOffset?: number;
    pendingPageNumber?: number;
    currentOffset?: number;
    currentPageNumber?: number;
    targetListView?: ListView | null;
    targetNode?: HTMLElement | null;
    updateSource?: UpdateSourceType;
    validationPassed?: boolean;
    initialPageSize?: number;
}

interface ValidateProps {
    listViewSize: number;
    pageSize: number;
    hideUnusedPaging: boolean;
    targetListView?: ListView | null;
    targetNode?: HTMLElement | null;
}

export default class PaginationContainer extends Component<ModelerProps, PaginationContainerState> {
    private widgetDOM: HTMLElement;
    private subscriptionTopic: string;

    readonly state: PaginationContainerState = {
        findingListViewWidget: true,
        hideUnusedPaging: false,
        isLoadingItems: false,
        listViewSize: 0,
        message: "",
        pageSize: 1
    };

    constructor(props: ModelerProps) {
        super(props);

        mendixLang.delay(this.findListView.bind(this), this.checkListViewAvailable.bind(this), 20);
        this.updateListView = this.updateListView.bind(this);
    }

    public static translateMessageStatus(fromValue: number, toValue: number, maxPageSize: number): string {
        return mxTranslation("mendix.lib.MxDataSource", "status", [ `${fromValue}`, `${toValue}`, `${maxPageSize}` ]);
    }

    componentDidMount() {
        (dojo as any).connect(this.props.mxform, "onPersistViewState", (formViewState) => {
            logger.debug("Storing state");
            const widgetViewState = formViewState[this.props.uniqueid] || (formViewState[this.props.uniqueid] = {});
            widgetViewState.pageSize = this.state.pageSize;
            widgetViewState.currentOffset = this.state.currentOffset;
            widgetViewState.currentPageNumber = this.state.currentPageNumber;
        });
    }

    render() {
        return createElement("div",
            {
                className: classNames("widget-pagination", this.props.class),
                ref: (widgetDOM) => this.widgetDOM = widgetDOM,
                style: SharedUtils.parseStyle(this.props.style)
            },
            createElement(Alert, {
                className: "widget-pagination-alert"
            }, this.state.message),
            this.renderPageButton()
        );
    }

    componentWillUnmount() {
        const targetNode = this.state.targetNode;

        showLoadMoreButton(targetNode);
    }

    private checkListViewAvailable(): boolean {
        return !!SharedContainerUtils.findTargetListView(this.widgetDOM.parentElement);
    }

    private renderPageButton(): ReactElement<PaginationProps> | null {
        if (this.state.validationPassed) {
            return createElement(Pagination, {
                getMessageStatus: PaginationContainer.translateMessageStatus,
                hideUnusedPaging: this.state.hideUnusedPaging,
                items: this.props.items,
                listViewSize: this.state.listViewSize,
                pageSize: this.state.pageSize,
                onClickAction: this.updateListView,
                pagingStyle: this.props.pagingStyle,
                publishedOffset: this.state.publishedOffset,
                publishedPageNumber: this.state.publishedPageNumber,
                updateSource: this.state.updateSource,
                pageSizeOnChange: this.applyPageSize,
                pageSizeOptions: this.props.pageSizeOptions
            });
        }

        return null;
    }

    private findListView() {
        if (this.state.findingListViewWidget) {
            const targetListView = SharedContainerUtils.findTargetListView(this.widgetDOM.parentElement);
            const targetNode = targetListView && targetListView.domNode;
            let hideUnusedPaging = false;
            let listViewSize = 0;
            let pageSize = 0;
            let dataSource: ListView["_datasource"];

            if (targetListView) {
                hideLoadMoreButton(targetNode);

                dataSource = targetListView._datasource;
                listViewSize = dataSource._setSize;
                pageSize = dataSource._pageSize;
                hideUnusedPaging = this.isHideUnUsed(targetListView);
                this.subscriptionTopic = `${targetListView.friendlyId}_${paginationTopicSuffix}`;

                this.afterListViewLoad(targetListView, targetNode);
                this.afterListViewDataRender(targetListView);
                this.beforeListViewDataRender(targetListView);
                this.subScribeToListViewChanges();
            }

            this.validateListView({ targetNode, targetListView, hideUnusedPaging, listViewSize, pageSize });
        }
    }

    private subScribeToListViewChanges() {
        dojoTopic.subscribe(this.subscriptionTopic, (message: TopicMessage) => {
            if (this.state.targetListView) {
                this.setState({
                    pageSize: message.newPageSize || this.state.pageSize,
                    publishedOffset: message.newOffSet,
                    publishedPageNumber: message.newPageNumber,
                    updateSource: "multiple"
                });
            }
        });
    }

    private afterListViewLoad(targetListView: ListView, targetNode: HTMLElement) {
        dojoAspect.after(targetListView, "_onLoad", () => {
            hideLoadMoreButton(targetNode);

            if (this.state.targetListView && this.state.targetNode) {

                targetNode = this.state.targetNode;
                const dataSource = this.state.targetListView._datasource;
                const listViewSize = dataSource._setSize;
                const pageSize = this.getPageState("pageSize", dataSource._pageSize);
                const offset = this.getPageState("currentOffset", 0);
                const pageNumber = this.getPageState("currentPageNumber", 1);
                const hideUnusedPaging = this.isHideUnUsed(this.state.targetListView) ;

                this.setState({
                    findingListViewWidget: false,
                    hideUnusedPaging,
                    listViewSize,
                    pageSize,
                    publishedOffset: offset,
                    publishedPageNumber: pageNumber,
                    targetListView,
                    targetNode,
                    updateSource: "multiple"
                });
                if (offset !== 0 || pageNumber !== 1 || pageSize !== dataSource._pageSize) {
                    this.updateListView(offset, pageNumber, pageSize, false);
                }
            }
        });
    }

    private getPageState<T>(key?: string, defaultValue?: T): T | undefined {
        const mxform = this.props.mxform;
        const widgetViewState = mxform && mxform.viewState ? mxform.viewState[this.props.uniqueid] : void 0;
        const state = 0 === arguments.length ? widgetViewState : widgetViewState && key in widgetViewState ? widgetViewState[key] : defaultValue;
        logger.debug("getPageState", key, defaultValue, state);
        return state;
    }

    private beforeListViewDataRender(targetListView: ListView) {
        dojoAspect.before(targetListView, "_renderData", () => {
            if (this.state.targetNode) {
                const listNode = getListNode(this.state.targetNode);

                setListNodeToEmpty(listNode);
            }
        });
    }

    private afterListViewDataRender(targetListView: ListView) {
        dojoAspect.after(targetListView, "_renderData", () => {
            const { pendingPageNumber, pendingOffset, currentOffset } = this.state;

            if (pendingPageNumber && pendingOffset && pendingOffset !== currentOffset) {
                this.updateListView(pendingOffset, pendingPageNumber);
            }

            if (this.state.targetListView) {
                const hideUnusedPaging = this.isHideUnUsed(this.state.targetListView) ;
                this.setState({ isLoadingItems: false, hideUnusedPaging });
            }

            resetListViewStructure(this.state.targetNode as HTMLElement);
            hideLoader(this.state.targetListView as ListView);
        });
    }

    private validateListView(props: ValidateProps) {
        const message = Validate.validate({
            ...this.props as ModelerProps,
            queryNode: props.targetNode,
            targetListView: props.targetListView
        });

        this.setState({
            findingListViewWidget: false,
            hideUnusedPaging: props.hideUnusedPaging,
            listViewSize: props.listViewSize,
            message,
            pageSize: props.pageSize,
            targetListView: props.targetListView,
            targetNode: props.targetNode,
            validationPassed: message === ""
        });
    }

    private updateListView(offSet: number, pageNumber: number, pageSize?: number, publish = true) {
        const { targetListView, targetNode, validationPassed, isLoadingItems } = this.state;

        if (targetListView && targetNode && validationPassed) {
            this.setState({ pendingOffset: offSet, pendingPageNumber: pageNumber });

            if (!isLoadingItems) {
                showLoader(targetListView);

                this.setState({
                    pageSize: pageSize || this.state.pageSize,
                    currentOffset: offSet,
                    currentPageNumber: pageNumber,
                    isLoadingItems: true
                });

                targetListView._datasource.setOffset(offSet);
                targetListView.sequence([ "_sourceReload", "_renderData" ]);
                if (publish) {
                    this.publishListViewUpdate({ newOffSet: offSet, newPageNumber: pageNumber });
                }
            }
        }
    }

    private publishListViewUpdate = (topicMessage: TopicMessage) => {
        if (this.state.targetListView) {
            dojoTopic.publish(this.subscriptionTopic, topicMessage);
        }
    }

    private isHideUnUsed(targetListView: ListView): boolean {
        const pageSize = targetListView._datasource._pageSize;

        return ((pageSize >= targetListView._datasource._setSize) || (pageSize === 0)) && this.props.hideUnusedPaging;
    }

    private applyPageSize = (onChangeProps: OnChangeProps) => {
        const { newPageSize, newOffSet } = onChangeProps;
        const { targetListView } = this.state;

        if (targetListView && targetListView._datasource
                && targetListView._datasource._pageSize !== newPageSize) {
            this.setState({
                pageSize: newPageSize,
                publishedOffset: newOffSet
            });
            targetListView._datasource._pageSize = newPageSize;
            targetListView._datasource.setOffset(newOffSet);
            targetListView.sequence([ "_sourceReload", "_renderData" ]);
            this.publishListViewUpdate({ ...onChangeProps });
        }
    }
}

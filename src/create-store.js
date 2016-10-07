import get from 'lodash/get';
import forOwn from 'lodash/forOwn';
import mapValues from 'lodash/mapValues';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';
import values from 'lodash/values';

import { ACTION_ON_MOUNT_STORES } from './constants';
import ChangeEmitter from './change-emitter';


export default function createStore(parentComponent, displayName, storeSpec) {

    return new Store(displayName, storeSpec, parentComponent);
}

class Store extends ChangeEmitter {

    constructor(displayName, storeSpec, parentComponent) {
        super();

        this.spec = storeSpec;
        this.parent = parentComponent;

        this.displayName = displayName + '_of_' + this.parent.displayName;
        this.dispatcher = this.parent.dispatcher;
        this.actions = this.parent.actions;
        this.stores = this.parent.stores;

        this.waitFor = this.waitFor.bind(this);

        this.actionHandlers = this.getActionHandlers();

        this.state = this.spec.getInitialState ? this.spec.getInitialState() : {};
        this.token = this.dispatcher.register(this.onAction.bind(this));
    }

    componentWillMount() {

        if (this.isMounted) {
            return;
        }
        this.isMounted = true;

        this.callStatePatcher(this.spec.componentWillMount);
    }

    componentWillUnmount() {

        /// No state updates on unmount:
        this.callFn(this.spec.componentWillUnmount);
        this.dispatcher.unregister(this.token);
    }

    callStatePatcher(fn, arg) {

        const patch = this.callFn(fn, arg);

        if (!patch) {
            return;
        }
        if (!this.state) {
            return this.patchState(patch);
        }

        for (const k in patch) {
            if (patch[k] !== this.state[k]) {
                return this.patchState(patch);
            }
        }
    }

    callFn(fn, arg) {

        return fn && fn.call(this.spec, arg, {
            state: this.state,
            props: this.parent.props,
            /// TODO: use only specific actions
            /// TODO: remove support for legacy spec.actions
            actions: (this.spec.actions || this.spec.actionsUse) && this.actions,
            waitFor: this.waitFor,
            addChangeListener: this.addChangeListener,
            removeChangeListener: this.removeChangeListener,
        });
    }

    patchState(patch) {

        this.state = { ...this.state, ...patch };
        this.emitChange(this.state);
        return this.state;
    }

    waitFor(...args) {

        /// ['a', ['a', 'b'], 'c'] → ['a', 'b', 'c']
        const names = uniq(Array.prototype.concat.apply([], args));
        /// TODO: check store names for typos and warn via console
        const stores = pick(names, this.stores);

        if (this.dispatcher.isDispatching()) {
            const tokens = values(stores).map(store => store.token);
            this.dispatcher.waitFor(tokens);
        }

        return mapValues(stores, store => store.state);
    }

    onAction({ actionId, argument }) {

        return this.callStatePatcher(this.actionHandlers[actionId], argument);
    }

    /**
     *  { groupName: { actionName: fn }} → { actionId: fn }
     */
    getActionHandlers() {

        const specHandlers = this.spec.getActionHandlers && this.spec.getActionHandlers();

        const actionHandlers = {};
        actionHandlers[ACTION_ON_MOUNT_STORES] = this.componentWillMount.bind(this);

        if (!specHandlers) {
            return actionHandlers;
        }

        forOwn(specHandlers, (actionGroup, actionGroupName) => {
            forOwn(actionGroup, (actionFn, actionName) => {

                const actionId = get(this.actions, [actionGroupName, actionName, 'actionId']);

                if (actionId) {
                    actionHandlers[actionId] = actionFn;
                } else {
                    console.error(
                        'Action', actionGroupName + '.' + actionName,
                        'not found for store', this.displayName,
                    );
                }
            })
        });

        return actionHandlers;
    }
}

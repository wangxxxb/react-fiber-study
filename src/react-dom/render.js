import { TAG_ROOT } from './constants';
import { scheduleRoot } from '../schedule';

function render(element, container) {
    const rootFiber = {
        tag: TAG_ROOT,
        stateNode: container,
        props: { children: [element] },
    };

    scheduleRoot(rootFiber);
}

export default render;

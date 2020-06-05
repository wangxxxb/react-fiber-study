import { TAG_ROOT, ELEMENT_TEXT, TAG_TEXT, TAG_HOST, PLACEMENT, DELETION, UPDATE } from './constants';
import { setProps } from './utils';

let nextUnitOfWork = null;
let workInProgressRoot = null;
let currentRoot = null; //当前根fiber
let deletions = []; // 需要删除的fiber

// 修改nextUnitOfWork workInProgressRoot
export function scheduleRoot(rootFiber) {
    // 双缓冲缓存，复用之前的fiber树
    if (currentRoot && currentRoot.alternate) {
        // 偶数次更新
        workInProgressRoot = currentRoot.alternate;
        workInProgressRoot.firstEffect = workInProgressRoot.lastEffect = workInProgressRoot.nextEffect = null;
        workInProgressRoot.props = rootFiber.props;
        workInProgressRoot.alternate = currentRoot;
    } else if (currentRoot) {
        // 奇数次更新
        // 当前的rootFiber挂载当前的currentRoot
        rootFiber.alternate = currentRoot;
        // 需处理的root更新为rootFiber
        workInProgressRoot = rootFiber;
    } else {
        // 第一次渲染
        workInProgressRoot = rootFiber;
    }

    nextUnitOfWork = workInProgressRoot;
}

function performUnitOfWork(currentFiber) {
    beginWork(currentFiber);
    if (currentFiber.child) {
        return currentFiber.child;
    }

    while (currentFiber) {
        completeUnitOfWork(currentFiber); //没有儿子让自己完成

        if (currentFiber.sibling) {
            return currentFiber.sibling;
        }
        currentFiber = currentFiber.return;
    }
}

function workLoop(deadline) {
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        shouldYield = deadline.timeRemaining() < 1; //没有时间的话就要让出控制权
    }

    if (!nextUnitOfWork && workInProgressRoot) {
        console.log('调和结束');
        commitRoot(); // commit阶段开始
    }

    requestIdleCallback(workLoop, { timeout: 500 });
}

// 提交阶段
function commitRoot() {
    // 删除需要删除的fiber
    deletions.forEach(commitWork);
    let currentFiber = workInProgressRoot.firstEffect;

    while (currentFiber) {
        commitWork(currentFiber);
        currentFiber = currentFiber.nextEffect;
    }

    console.log('commit结束');
    deletions.length = 0;
    // commit阶段结束更新currentRoot
    currentRoot = workInProgressRoot;
    workInProgressRoot = null;
}

// commit任务
function commitWork(currentFiber) {
    if (!currentFiber) return;
    const returnFiber = currentFiber.return;
    const retrunDom = returnFiber.stateNode;

    if (currentFiber.effectTag === PLACEMENT) {
        retrunDom.appendChild(currentFiber.stateNode);
    } else if (currentFiber.effectTag === DELETION) {
        retrunDom.removeChild(currentFiber.stateNode);
    } else if (currentFiber.effectTag === UPDATE) {
        if (currentFiber.type === ELEMENT_TEXT) {
            if (currentFiber.alternate.props.text !== currentFiber.props.text) {
                currentFiber.stateNode.textContent = currentFiber.props.text;
            }
        } else {
            updateDom(currentFiber.stateNode, currentFiber.alternate.props, currentFiber.props);
        }
    }
}

// 开始任务
function beginWork(currentFiber) {
    if (currentFiber.tag === TAG_ROOT) {
        updateHostRoot(currentFiber);
    } else if (currentFiber.tag === TAG_TEXT) {
        updateHostText(currentFiber);
    } else if (currentFiber.tag === TAG_HOST) {
        updateHost(currentFiber);
    }
}

// 结束任务
function completeUnitOfWork(currentFiber) {
    let returnFiber = currentFiber.return;

    if (returnFiber) {
        // 如果父fiber没有firstEffect，则将自己的firstEffect挂在上去
        if (!returnFiber.firstEffect) {
            returnFiber.firstEffect = currentFiber.firstEffect;
        }

        // 这里保证自己的子节点的effectList要挂载到父级fiber的effectList上，先不考虑自己是否需要挂载，后面判断effectTag才会考虑将自己挂载在lastEffect
        if (currentFiber.lastEffect) {
            if (returnFiber.lastEffect) {
                returnFiber.lastEffect.nextEffect = currentFiber.firstEffect;
            }
            returnFiber.lastEffect = currentFiber.lastEffect;
        }
        const effectTag = currentFiber.effectTag;

        if (effectTag) {
            if (returnFiber.lastEffect) {
                returnFiber.lastEffect.nextEffect = currentFiber;
            } else {
                // 如果returnFiber没有lastEffect，说明当前children是没有被遍历处理过的，只要处理过一个节点，父节点就会有first/lastEffect
                returnFiber.firstEffect = currentFiber;
            }
            // 因为自身有effectTag，所以需要在最后将自己也挂载在lastEffect上
            returnFiber.lastEffect = currentFiber;
        }
    }
}

function createDom(currentFiber) {
    if (currentFiber.tag === TAG_TEXT) {
        return document.createTextNode(currentFiber.props.text);
    } else if (currentFiber.tag === TAG_HOST) {
        const stateNode = document.createElement(currentFiber.type);
        updateDom(stateNode, {}, currentFiber);
        return stateNode;
    }
}

function updateHostRoot(rootFiber) {
    console.log(rootFiber);
    const newChildren = rootFiber.props.children;
    reconcileChildren(rootFiber, newChildren);
}

function updateHostText(currentFiber) {
    if (!currentFiber.stateNode) {
        currentFiber.stateNode = createDom(currentFiber);
    }
}

function updateHost(currentFiber) {
    if (!currentFiber.stateNode) {
        currentFiber.stateNode = createDom(currentFiber);
    }

    // 处理children
    const newChildren = currentFiber.props.children;
    reconcileChildren(currentFiber, newChildren);
}

// 更新属性
function updateDom(stateNode, oldProps, currentFiber) {
    setProps(stateNode, oldProps, currentFiber.props);
}

// 调合children
function reconcileChildren(currentFiber, newChildren) {
    let newChildrenIndex = 0;
    let prevSibling = null;
    // 获取旧的fiber里面的第一个子fiber
    let oldFiber = currentFiber.alternate && currentFiber.alternate.child;

    while (newChildrenIndex < newChildren.length || oldFiber) {
        let newChild = newChildren[newChildrenIndex];
        let tag, newFiber;
        // 判断新老fiber的type是否一致
        const sameType = oldFiber && newChild && oldFiber.type === newChild.type;

        // 这里判断是原生节点还是文本节点
        if (newChild && newChild.type === ELEMENT_TEXT) {
            tag = TAG_TEXT;
        } else if (newChild && typeof newChild.type === 'string') {
            tag = TAG_HOST;
        }

        if (sameType) {
            if (oldFiber.alternate) {
                newFiber = oldFiber.alternate;
                newFiber.props = newChild.props;
                newFiber.alternate = oldFiber;
                newFiber.effectTag = UPDATE;
                newFiber.nextEffect = null;
            } else {
                newFiber = {
                    tag: oldFiber.tag,
                    type: oldFiber.tag,
                    props: newChild.props,
                    stateNode: oldFiber.stateNode,
                    return: currentFiber,
                    effectTag: UPDATE,
                    nextEffect: null,
                    alternate: oldFiber,
                };
            }
        } else {
            if (newChild) {
                newFiber = {
                    tag,
                    type: newChild.type,
                    props: newChild.props,
                    stateNode: newChild.stateNode,
                    return: currentFiber,
                    effectTag: PLACEMENT,
                    nextEffect: null,
                };
            }

            if (oldFiber) {
                oldFiber.effectTag = DELETION;
                deletions.push(oldFiber);
            }
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }

        if (newFiber) {
            if (newChildrenIndex === 0) {
                currentFiber.child = newFiber;
            } else {
                prevSibling.sibling = newFiber;
            }

            prevSibling = newFiber;
        }

        newChildrenIndex++;
    }
}

window.requestIdleCallback(workLoop, { timeout: 500 });

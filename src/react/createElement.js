import { ELEMENT_TEXT } from './constants';

function createElement(type, config, ...children) {
    // 清除打包工具导致的干扰属性
    delete config.__source;
    delete config.__self;

    return {
        type,
        props: {
            ...config,
            children: children.map((child) => {
                return typeof child === 'object'
                    ? child
                    : {
                          type: ELEMENT_TEXT,
                          props: {
                              text: child,
                              children: [],
                          },
                      };
            }),
        },
    };
}

export default createElement;

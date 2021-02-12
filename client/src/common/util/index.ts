import * as babel from '@babel/standalone'
import * as typeis from './typeis'

/**
 * 限流函数
 * @param callback
 */
export const limitChange = (callback: Function, delay: number = 500) => {
  let t: any = null
  return (...args: any[]) => {
    clearTimeout(t)
    t = setTimeout(callback, delay, ...args)
  }
}

export function formatJson (json: any) {
  if (json === undefined || typeof json === 'string') return json
  try {
    return JSON.stringify(json, null, 2)
  } catch (e) {
    return ''
  }
}

export function parseJson (json: string): any {
  try {
    return JSON.parse(json)
  } catch (e) {
    return json
  }
}

// 查找父节点
export function getTreeParent (tree: any[], id: any) {
  const temp: any[] = []
  const forFn = function (childrenTree: any[], itemId: any) {
    for (let i = 0; i < childrenTree.length; i++) {
      const item = childrenTree[i]
      if (item.id === itemId) {
        temp.push(item)
        forFn(tree, item.pid)
        break
      } else if (item.children) {
        forFn(item.children, itemId)
      }
    }
  }
  forFn(tree, id)
  return temp.reverse()
}

export function buildCode (code: string): Function | null {
  if (!code) return null
  const result = babel.transform(code, { presets: ['env'] })
  // eslint-disable-next-line no-eval
  const fun: Function = result.code ? eval(result.code) : null
  return fun
}

export { typeis }

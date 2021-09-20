import fs from 'fs';
import path from 'path';
import type markdownIt from 'markdown-it';
import { getContributors } from './utils';

const componentPath = path.join(__dirname, './component.vue');

let demoImports: Record<string, string> = {};
let demoCodeImports: Record<string, string> = {};

export default {
  before(source: string, id: string) {
    const resouceDir = path.dirname(id);
    const reg = id.match(/src\/(\w+-?\w+)\/\w+-?\w+\.md/);
    const name = reg ? reg[1] : null;
    demoImports = {};
    demoCodeImports = {};

    // 统一换成 common 文档内容
    if (name && source.includes(':: BASE_DOC ::')) {
      const docPath = path.resolve(__dirname, `../../common/docs/mobile/api/${name}.md`);
      if (fs.existsSync(docPath)) {
        const baseDoc = fs.readFileSync(docPath, 'utf-8');
        source = source.replace(':: BASE_DOC ::', baseDoc);
      } else {
        console.error(`未找到 ${docPath} 文件`);
      }
    }

    // 替换成对应 demo 文件
    source = source.replace(/\{\{\s+(.+)\s+\}\}/g, (demoStr, demoFileName) => {
      const demoPath = path.resolve(resouceDir, `./demos/${demoFileName}.vue`);
      if (!fs.existsSync(demoPath)) {
        console.log('\x1B[36m%s\x1B[0m', `${name} 组件需要实现 demos/${demoFileName}.vue 示例!`);
        return '\n<h3>DEMO (🚧建设中）...</h3>';
      }

      return `\n::: demo demos/${demoFileName} ${name}\n:::\n`;
    });

    // 解析 api 占位符
    if (source.includes(':: BASE_PROPS ::')) {
      const apiDoc = fs.readFileSync(path.resolve(resouceDir, './api.md'), 'utf-8');
      source = source.replace(':: BASE_PROPS ::', apiDoc);
    }

    source.replace(/:::\s*demo\s+([\\/.\w-]+)/g, (demoStr: string, relativeDemoPath: string) => {
      const demoPathOnlyLetters = relativeDemoPath.replace(/[^a-zA-Z\d]/g, '');
      const demoDefName = `Demo${demoPathOnlyLetters}`;
      const demoCodeDefName = `Demo${demoPathOnlyLetters}Code`;
      demoImports[demoDefName] = `import ${demoDefName} from './${relativeDemoPath}.vue';`;
      demoCodeImports[demoCodeDefName] = `import ${demoCodeDefName} from './${relativeDemoPath}.vue?raw';`;
      return '';
    });

    return source;
  },
  after(_source: string, _id: string, renderInfo: any, md: markdownIt) {
    const demoCodeImportsStr = Object.keys(demoCodeImports).map(demoCodeDefName => demoCodeImports[demoCodeDefName]).join('\n');
    const demoCodeDefsStr = Object.keys(demoCodeImports).join(',');

    const { title, description, docMd, apiMd, demoMd, designMd, isComponent, mobileUrl } = renderInfo;

    const mdSegment = {
      title,
      description,
      mobileUrl,
      isComponent,
      issueInfo: {},
      contributors: getContributors(),
      docMd: md.render.call(md, docMd),
      apiMd: md.render.call(md, apiMd),
      demoMd: md.render.call(md, demoMd),
      designMd: md.render.call(md, designMd),
    };

    const sfc = `<template><tdesign-doc :doc-type="docType" /></template>
      <script>
        import TdesignDoc from '${componentPath}';
        import { defineComponent } from 'vue';
        ${demoCodeImportsStr}

        export default defineComponent({
          props: { docType: String },
          components: { TdesignDoc },
          provide: { info: ${JSON.stringify(mdSegment)}, demos: { ${demoCodeDefsStr} } },
        });
      </script>`;

    return sfc;
  }
};
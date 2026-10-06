// Arithmetic parser: no eval, Function, property access or executable input.
export function calculate(input:string):number{
  if(input.length>200)throw new Error('Expression is too long.');
  const tokens=input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/%\-]/g)??[];
  if(tokens.join('')!==input.replace(/\s/g,''))throw new Error('Use numbers and arithmetic operators only.');
  let pos=0,depth=0;
  const atom=():number=>{if(++depth>30)throw new Error('Too many parentheses.');let value:number;const t=tokens[pos++];if(t==='-')value=-atom();else if(t==='+')value=atom();else if(t==='('){value=sum();if(tokens[pos++]!==')')throw new Error('Missing closing parenthesis.');}else if(t&&/^\d|^\.\d/.test(t))value=Number(t);else throw new Error('Enter a complete expression.');depth--;return value;};
  const product=():number=>{let value=atom();while(['*','/','%'].includes(tokens[pos])){const op=tokens[pos++],right=atom();value=op==='*'?value*right:op==='/'?value/right:value%right;}return value;};
  const sum=():number=>{let value=product();while(['+','-'].includes(tokens[pos])){const op=tokens[pos++],right=product();value=op==='+'?value+right:value-right;}return value;};
  const result=sum();if(pos!==tokens.length||!Number.isFinite(result))throw new Error('Invalid expression or division by zero.');return result;
}

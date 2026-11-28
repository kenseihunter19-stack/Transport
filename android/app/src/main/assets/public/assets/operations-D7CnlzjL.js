import{t as e}from"./createLucideIcon-Bdr3QCoh.js";var t=e(`check`,[[`path`,{d:`M20 6 9 17l-5-5`,key:`1gmf2c`}]]);function n(e,t){let n=`﻿`+t.map(e=>e.map(e=>`"`+String(e).replaceAll(`"`,`""`)+`"`).join(`;`)).join(`\r
`),r=URL.createObjectURL(new Blob([n],{type:`text/csv;charset=utf-8`})),i=document.createElement(`a`);i.href=r,i.download=e,i.click(),URL.revokeObjectURL(r)}function r(e,t){let n=URL.createObjectURL(new Blob([e+`

`+t],{type:`text/plain;charset=utf-8`})),r=document.createElement(`a`);r.href=n,r.download=e+`.txt`,r.click(),URL.revokeObjectURL(n)}export{r as n,t as r,n as t};
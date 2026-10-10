import {Document,Image,Page,StyleSheet,Text,View,type DocumentProps} from "@react-pdf/renderer";
import type {ReactElement} from "react";
import type {AtlasMemoPdfSource} from "./source";
export type {AtlasMemoPdfSource} from "./source";
// Reuse the existing local fonts and its serialized queue: Font is a process-wide store.
import {renderPairPdf as renderPrivatePdf} from "@/server/pair-pdf/render";
import {pairPdfText as pdfText} from "@/server/pair-pdf/document";
import {pairPdfGem as localGem} from "@/server/pair-pdf/gems";
const fonts=["PairGolos","PairEmoji"],titles=["PairCormorant","PairGolos","PairEmoji"];
const s=StyleSheet.create({
 page:{backgroundColor:"#FAF8F2",color:"#193329",padding:38,paddingBottom:65,fontFamily:fonts,fontSize:10,lineHeight:1.45},
 masthead:{backgroundColor:"#0A1F17",padding:22,marginBottom:20,borderRadius:3},
 brand:{fontSize:9,letterSpacing:3,color:"#CDB57B",marginBottom:12},
 title:{fontFamily:titles,fontSize:35,lineHeight:1.05,color:"#EFE9DA",marginBottom:7},
 subtitle:{fontSize:9,color:"#CDB57B",marginBottom:16},
 identity:{flexDirection:"row",alignItems:"center"},gem:{width:64,height:64,marginRight:15,objectFit:"contain"},
 name:{fontSize:11,color:"#EFE9DA",marginBottom:3},type:{fontSize:10,color:"#CDB57B"},
 scores:{flexDirection:"row",gap:12,marginBottom:20},trait:{flexGrow:1,flexBasis:0},traitCode:{fontWeight:600,fontSize:9,color:"#746135",marginBottom:4},
 score:{fontSize:9,marginBottom:4},bar:{height:4,backgroundColor:"#DCE1D5"},fill:{height:4,backgroundColor:"#A58B4F"},
 quote:{borderLeftWidth:2,borderLeftColor:"#A58B4F",paddingLeft:14,marginBottom:20,fontFamily:titles,fontSize:23,lineHeight:1.2},
 item:{marginBottom:14},label:{fontSize:8.5,fontWeight:600,color:"#746135",marginBottom:4},body:{fontSize:10,lineHeight:1.5},
 note:{fontSize:8,color:"#55695D",lineHeight:1.5,marginTop:5},
 footer:{position:"absolute",left:38,right:38,bottom:22,height:26,borderTopWidth:1,borderTopColor:"#D6D9CD",paddingTop:7,fontSize:7.5,color:"#55695D",flexDirection:"row",justifyContent:"space-between"},
});
export function buildAtlasMemoPdf(source:AtlasMemoPdfSource):ReactElement<DocumentProps>{
 const when=new Date(source.generatedAt).toLocaleString("ru-RU",{timeZone:"Asia/Yekaterinburg",dateStyle:"medium",timeStyle:"short"});
 const empty="Пока не заполнено";
 return <Document title="Моя личная памятка | Грани" author="Грани" language="ru-RU"><Page size="A4" style={s.page}>
  <View style={s.masthead}><Text style={s.brand}>ГРАНИ</Text><Text style={s.title}>Моя личная памятка</Text><Text style={s.subtitle}>Мои грани - инструкция к себе</Text><View style={s.identity}><Image src={localGem(source.gemDir)} style={s.gem}/><View style={{flex:1}}><Text style={s.name}>{pdfText(source.displayName)}</Text><Text style={s.type}>{pdfText(source.typeName)} · {source.typeCode}</Text></View></View></View>
  <View style={s.scores} wrap={false}>{source.model.traits.map(trait=><View style={s.trait} key={trait.code}><Text style={s.traitCode}>{trait.code}</Text><Text style={s.score}>{trait.value} / 100</Text><View style={s.bar}><View style={[s.fill,{width:trait.value+"%"}]}/></View></View>)}</View>
  <Text style={[s.quote,source.memo.quote.length>300?{fontFamily:fonts,fontSize:11,lineHeight:1.5}:{}]}>{pdfText(source.memo.quote||empty)}</Text>
  {source.model.memo.items.map((item,i)=><View style={s.item} key={item.label}><Text style={s.label} minPresenceAhead={28}>{pdfText(item.label)}</Text><Text style={s.body} orphans={2} widows={2}>{pdfText(source.memo.items[i]||empty)}</Text></View>)}
  <Text style={s.note}>Шкалы: O - открытость опыту; C - добросовестность; E - экстраверсия; A - доброжелательность; S - эмоциональная устойчивость. Баллы из ответов теста, не процентили. Более высокий балл не означает «лучше».</Text>
  <Text style={s.note}>Интерпретации - редакционные гипотезы для самонаблюдения. Это не психологическая и не медицинская диагностика. Отредактированные формулировки отражают твой выбор.</Text>
  <Text style={s.note}>Сохранённая версия на {when} (Екатеринбург). Версия {source.revision}. Файл содержит личные данные; делись им по своему выбору. Изменение или удаление атласа не удаляет скачанную копию.</Text>
  <Text style={s.note}>Редкие символы вне локальных шрифтов показаны как [U+код].</Text>
  <View style={s.footer} fixed><Text>Грани · Приватная памятка</Text><Text style={{position:"absolute",right:0,top:7,width:48,textAlign:"right"}} render={({pageNumber,totalPages})=>pageNumber+" / "+totalPages}/></View>
 </Page></Document>;
}
export const renderAtlasMemoPdf=(source:AtlasMemoPdfSource)=>renderPrivatePdf(buildAtlasMemoPdf(source));

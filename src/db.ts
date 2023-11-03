import { Cat } from './cat';
import { urlid } from './genid';
import { assert } from './utils';

interface Database {
  cats: Cat[];
}

const data:Database = {
  cats: [],
}

function initDb() {
  data.cats = [{
    id: "snm398Wmy",
    name: "Oscar",
    age: 10,
    claws: true,
  },{
    id: urlid(),
    name: "Charles",
    age: 4,
    claws: false,
  }
  ]
}
initDb();

export function allCats():Cat[] {
  return data.cats;
}

export function getCat(id:string) : Cat|undefined {
  return data.cats.find((cat) => cat.id === id);
}

export function insertCat(cat:Cat):Cat {
  if (!cat.id) {
    cat.id = urlid();
  }
  assert(!getCat(cat.id));

  data.cats.push(cat);

  return cat;
}

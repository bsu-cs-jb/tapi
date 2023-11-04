async function hello1() {
  console.log("hello");
  const response = await fetch("https://jsonplaceholder.typicode.com/todos/23");
  if (response.status == 200) {
    console.log(await response.json());
  }
}

async function hello() {
  const response = fetch("https://jsonplaceholder.typicode.com/todos/23");
  console.log("after fetch");
  response.then((response) => {
    console.log("response received");
    response.json().then((value) => {
      console.log(value);
    });
  });
  console.log("function is over");
}
hello();
console.log("Hello is over");

async function logMovies() {
  const responsePromise = fetch("http://example.com/movies.json");

  responsePromise
    .then((response) => {
      // call another fetch returns a promise
    })
    .then((response) => {
      // a second callback
    })
    .catch((reason) => {
      // ERROR
    });

  // IN the preset
  // this will wait for the server to answer
  try {
    const response = await fetch("http://example.com/movies.json");
  } catch {
    // ERROR
  }
}

function dontDoThis() {
  logMovies();

  fetch("https://jsonplaceholder.typicode.com/todos/23")
    .then((response) => response.json())
    .then((json) => console.log(json));

  fetch("https://jsonplaceholder.typicode.com/todos", {
    method: "POST",
    body: JSON.stringify({
      userId: 5,
      title: "Feed the dogs",
    }),
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  })
    .then((response) => response.json())
    .then((json) => console.log(json));

  fetch("https://jsonplaceholder.typicode.com/todos/200")
    .then((response) => response.json())
    .then((json) => console.log(json));
}
